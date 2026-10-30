-- Migration 004b: outcomes, lessons, sustainability plans
-- See docs/data-model.md §2 "Delivery and results (migration 004)".
--
-- Backlog item 6b.
--
-- Outcomes state what was achieved and link to an assertion so they carry a
-- claim / documented / verified badge. Target and achieved are free text on
-- purpose (e.g. "120 pupils enrolled", "roof finished"): this is evidence and
-- narrative, not a scoring system.
--
-- Privacy: RLS is enabled with NO policies. No personal data columns here;
-- these are written as public-facing narrative.

-- ---------------------------------------------------------------------------
-- outcomes
-- ---------------------------------------------------------------------------
create table public.outcomes (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  description   text not null check (length(btrim(description)) > 0),
  measure       text,
  target        text,
  achieved      text,
  assertion_id  uuid,
  created_at    timestamptz not null default now(),
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete set null (assertion_id)
);

create index outcomes_project_idx on public.outcomes(project_id);

-- ---------------------------------------------------------------------------
-- lessons — what was learned, including from mistakes
-- ---------------------------------------------------------------------------
create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  lesson       text not null check (length(btrim(lesson)) > 0),
  recorded_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

create index lessons_project_idx on public.lessons(project_id);

-- ---------------------------------------------------------------------------
-- sustainability_plans — how the work continues after the original funding
-- ---------------------------------------------------------------------------
create table public.sustainability_plans (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  plan                text not null check (length(btrim(plan)) > 0),
  funding_after_grant text,
  local_owner         text,
  review_on           date,
  created_at          timestamptz not null default now()
);

create index sustainability_plans_project_idx on public.sustainability_plans(project_id);

comment on column public.sustainability_plans.local_owner is
  'Organization or role name (not a private individual''s personal details)';

alter table public.outcomes             enable row level security;
alter table public.lessons              enable row level security;
alter table public.sustainability_plans enable row level security;
