-- Migration 005: Kingdom Return entries
-- See docs/data-model.md §2 "Kingdom Return (migration 005)" and the concept
-- paper §6.
--
-- Backlog item 7.
--
-- The five dimensions (Multiplication, Subtraction, Stewardship,
-- Sustainability, Restoration) are recorded as NARRATIVE plus LINKED
-- EVIDENCE. There is deliberately no score, rating, rank, or other numeric
-- column anywhere in this migration: fruit is documented, not reduced to a
-- number. Please keep it that way.
--
-- An entry's credibility comes from what it links to: each linked assertion
-- carries its own claim / documented / verified status.
--
-- Privacy: RLS is enabled with NO policies.
--
-- Also extends the verifier-independence check to Kingdom Return authors.

create type public.kingdom_return_dimension as enum
  ('multiplication', 'subtraction', 'stewardship', 'sustainability', 'restoration');

-- ---------------------------------------------------------------------------
-- kingdom_return_entries
-- ---------------------------------------------------------------------------
create table public.kingdom_return_entries (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  dimension    public.kingdom_return_dimension not null,
  narrative    text not null check (length(btrim(narrative)) > 0),
  recorded_on  date not null default current_date,
  author_id    uuid references public.people(id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (id, project_id)
);

create index kingdom_return_entries_project_idx
  on public.kingdom_return_entries(project_id, dimension);

comment on table public.kingdom_return_entries is
  'Narrative per dimension. No score column by design (concept paper §6).';

-- ---------------------------------------------------------------------------
-- kingdom_return_links — each row links an entry to ONE assertion or ONE
-- evidence item from the same project.
-- ---------------------------------------------------------------------------
alter table public.evidence_items
  add constraint evidence_items_id_project_key unique (id, project_id);

create table public.kingdom_return_links (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null,
  entry_id          uuid not null,
  assertion_id      uuid,
  evidence_item_id  uuid,
  created_at        timestamptz not null default now(),
  constraint link_exactly_one_target
    check ((assertion_id is null) <> (evidence_item_id is null)),
  foreign key (entry_id, project_id)
    references public.kingdom_return_entries(id, project_id) on delete cascade,
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete cascade,
  foreign key (evidence_item_id, project_id)
    references public.evidence_items(id, project_id) on delete cascade
);

create unique index kingdom_return_links_assertion_uq
  on public.kingdom_return_links(entry_id, assertion_id) where assertion_id is not null;
create unique index kingdom_return_links_evidence_uq
  on public.kingdom_return_links(entry_id, evidence_item_id) where evidence_item_id is not null;

alter table public.kingdom_return_entries enable row level security;
alter table public.kingdom_return_links   enable row level security;

-- ---------------------------------------------------------------------------
-- Verifier independence: add Kingdom Return authors
-- (replaces the function from migration 004a; trigger unchanged)
-- ---------------------------------------------------------------------------
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
