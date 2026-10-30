-- Migration 004a: evidence items and progress reports
-- See docs/data-model.md §2 "Delivery and results (migration 004)".
--
-- Backlog item 6a. Outcomes, lessons, and sustainability plans come in 6b.
--
-- Evidence items are physical-world proof of delivery (photos, site
-- reports...). They link to an assertion but do NOT change its status on
-- their own: status still comes only from documents (documented) and
-- independent verifications (verified), per the three-state rule.
--
-- Privacy: RLS is enabled with NO policies. Precise GPS is PRIVATE (public
-- views show location_label only). Evidence that shows identifiable people
-- is PRIVATE as a whole and never appears in public views.
--
-- Also extends the verifier-independence check to progress report authors.

-- ---------------------------------------------------------------------------
-- evidence_items
-- ---------------------------------------------------------------------------
create type public.evidence_kind as enum
  ('photo', 'video', 'receipt', 'site_report', 'other');

create table public.evidence_items (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  assertion_id              uuid not null,
  kind                      public.evidence_kind not null,
  caption                   text not null check (length(btrim(caption)) > 0),
  captured_on               date,
  location_label            text,
  storage_path              text,
  shows_identifiable_people boolean not null default false,
  -- PRIVATE: precise location can endanger people
  gps_lat                   numeric(9, 6) check (gps_lat between -90 and 90),
  gps_lng                   numeric(9, 6) check (gps_lng between -180 and 180),
  created_at                timestamptz not null default now(),
  constraint gps_both_or_neither
    check ((gps_lat is null) = (gps_lng is null)),
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete cascade
);

create index evidence_items_project_idx   on public.evidence_items(project_id);
create index evidence_items_assertion_idx on public.evidence_items(assertion_id);

comment on column public.evidence_items.gps_lat is 'PRIVATE';
comment on column public.evidence_items.gps_lng is 'PRIVATE';
comment on column public.evidence_items.shows_identifiable_people is
  'When true the whole item is PRIVATE and excluded from public views';

-- ---------------------------------------------------------------------------
-- progress_reports
-- ---------------------------------------------------------------------------
create table public.progress_reports (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  summary       text not null check (length(btrim(summary)) > 0),
  setbacks      text,
  author_id     uuid references public.people(id) on delete restrict,
  assertion_id  uuid,
  created_at    timestamptz not null default now(),
  constraint period_in_order check (period_start <= period_end),
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete set null (assertion_id)
);

create index progress_reports_project_idx on public.progress_reports(project_id);

comment on column public.progress_reports.setbacks is
  'Setbacks are recorded openly (Restoration dimension), not hidden';

alter table public.evidence_items   enable row level security;
alter table public.progress_reports enable row level security;

-- ---------------------------------------------------------------------------
-- Verifier independence: add progress report authors
-- (replaces the function from migration 003b; trigger unchanged)
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

  return new;
end;
$$;
