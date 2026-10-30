-- Migration 007: evidence items count toward "documented"
-- Decided by Travis, 2026-10-30: a piece of evidence (site photo, video,
-- site report...) counts like a document when deriving assertion status.
--
--   verified    = at least one confirmed, unflagged, independent verification
--   documented  = otherwise, at least one document OR evidence item
--   claim       = otherwise
--
-- Evidence still never counts as a verification: the three states stay
-- distinct.
--
-- Also adds evidence_items.uploaded_by so that whoever supplied the evidence
-- can't then verify the same project (same rule as document uploaders).
-- Not shown in any public view.

alter table public.evidence_items
  add column uploaded_by uuid references public.people(id) on delete restrict;

create or replace function public.compute_assertion_status(p_assertion_id uuid)
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
    ) or exists (
      select 1 from public.evidence_items e
      where e.assertion_id = p_assertion_id
    ) then 'documented'::public.assertion_status
    else 'claim'::public.assertion_status
  end;
$$;

create trigger evidence_items_refresh_assertion_status
  after insert or update or delete on public.evidence_items
  for each row execute function public.refresh_assertion_status();

-- Bring existing assertions up to date (no-op on a fresh database).
update public.assertions set status = status;

-- Verifier independence: add evidence uploaders
-- (replaces the function from migration 005; trigger unchanged)
create or replace function public.verifications_require_independence()
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

  if exists (select 1 from public.evidence_items e
             where e.project_id = v_project_id
               and e.uploaded_by = new.verifier_id) then
    raise exception 'Verifier is not independent: supplied evidence for this project';
  end if;

  if exists (select 1 from public.funds_received f
             where f.project_id = v_project_id
               and f.donor_person_id = new.verifier_id) then
    raise exception 'Verifier is not independent: gave funds to this project';
  end if;

  if exists (select 1 from public.purchases pu
             join public.suppliers s on s.id = pu.supplier_id
             where pu.project_id = v_project_id
               and s.contact_person_id = new.verifier_id) then
    raise exception 'Verifier is not independent: contact for a supplier to this project';
  end if;

  if exists (select 1 from public.progress_reports r
             where r.project_id = v_project_id
               and r.author_id = new.verifier_id) then
    raise exception 'Verifier is not independent: wrote a progress report for this project';
  end if;

  if exists (select 1 from public.kingdom_return_entries k
             where k.project_id = v_project_id
               and k.author_id = new.verifier_id) then
    raise exception 'Verifier is not independent: wrote a Kingdom Return entry for this project';
  end if;

  return new;
end;
$$;
