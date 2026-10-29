-- Migration 002b: assertion status sync + verifier independence (backlog item 4b)
-- See docs/data-model.md §1 (three-state rule).
--
-- (1) Status sync. `assertions.status` is never set by hand. It is always
--     derived from the rows that support it:
--       verified    = at least one verification with finding 'confirmed'
--                     that is NOT tie_flagged
--       documented  = otherwise, at least one document
--       claim       = otherwise
--     Adding, changing, flagging or removing a document or verification
--     recomputes the status, so it drops back down when support goes away.
--
-- (2) Verifier independence. A verification is rejected if the verifier
--     appears anywhere in the project's records so far: a project leader,
--     the author of any of the project's assertions, the uploader of any of
--     its documents, or a beneficiary. Later migrations (003-005) extend
--     this to donors, supplier contacts, report authors and Kingdom Return
--     authors. Ties the database can't see are covered by the required
--     independence_declaration.

-- ---------------------------------------------------------------------------
-- (1) Status sync
-- ---------------------------------------------------------------------------
create function public.compute_assertion_status(p_assertion_id uuid)
returns public.assertion_status
language sql stable as $$
  select case
    when exists (
      select 1 from public.verifications v
      where v.assertion_id = p_assertion_id
        and v.finding = 'confirmed'
        and not v.tie_flagged
    ) then 'verified'::public.assertion_status
    when exists (
      select 1 from public.documents d
      where d.assertion_id = p_assertion_id
    ) then 'documented'::public.assertion_status
    else 'claim'::public.assertion_status
  end;
$$;

-- Any write to an assertion gets the derived status, whatever was supplied.
-- (On insert there can be no documents or verifications yet, so it is 'claim'.)
create function public.assertions_derive_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'claim';
  else
    new.status := public.compute_assertion_status(new.id);
  end if;
  return new;
end;
$$;

create trigger assertions_derive_status
  before insert or update on public.assertions
  for each row execute function public.assertions_derive_status();

-- After a document or verification changes, re-derive the status of the
-- affected assertion(s). The update fires assertions_derive_status above.
create function public.refresh_assertion_status()
returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.assertions a
       set status = public.compute_assertion_status(a.id)
     where a.id = old.assertion_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.assertions a
       set status = public.compute_assertion_status(a.id)
     where a.id = new.assertion_id;
  end if;
  return null;
end;
$$;

create trigger documents_refresh_assertion_status
  after insert or update or delete on public.documents
  for each row execute function public.refresh_assertion_status();

create trigger verifications_refresh_assertion_status
  after insert or update or delete on public.verifications
  for each row execute function public.refresh_assertion_status();

-- ---------------------------------------------------------------------------
-- (2) Verifier independence
-- ---------------------------------------------------------------------------
create function public.verifications_require_independence()
returns trigger language plpgsql as $$
declare
  v_project_id uuid;
begin
  select a.project_id into v_project_id
    from public.assertions a where a.id = new.assertion_id;

  if exists (select 1 from public.people p
             where p.id = new.verifier_id and p.is_beneficiary) then
    raise exception 'Verifier is not independent: a beneficiary cannot verify';
  end if;

  if exists (select 1 from public.project_leaders pl
             where pl.project_id = v_project_id
               and pl.person_id = new.verifier_id) then
    raise exception 'Verifier is not independent: listed as a leader of this project';
  end if;

  if exists (select 1 from public.assertions a
             where a.project_id = v_project_id
               and a.asserted_by = new.verifier_id) then
    raise exception 'Verifier is not independent: made an assertion in this project';
  end if;

  if exists (select 1 from public.documents d
             join public.assertions a on a.id = d.assertion_id
             where a.project_id = v_project_id
               and d.uploaded_by = new.verifier_id) then
    raise exception 'Verifier is not independent: uploaded documents for this project';
  end if;

  return new;
end;
$$;

create trigger verifications_require_independence
  before insert or update of verifier_id, assertion_id on public.verifications
  for each row execute function public.verifications_require_independence();
