-- Migration 001: core passport tables
-- organizations, people, projects, project_leaders.
-- See docs/data-model.md §2 "Core (migration 001)".
--
-- Privacy: every table has RLS enabled with NO policies yet, so anon and
-- authenticated roles can read nothing until backlog item 8 adds policies and
-- the public_* views. Columns marked "PRIVATE" must never appear in a
-- public_* view.
--
-- Money is recorded only; nothing in this schema moves or solicits funds.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- organizations — the responsible ministry or partner
-- ---------------------------------------------------------------------------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  country             text,
  region              text,
  description         text,
  website             text,
  -- PRIVATE
  registration_number text,
  contact_email       text,
  contact_phone       text,
  address_line        text,
  created_at          timestamptz not null default now()
);

comment on column public.organizations.registration_number is 'PRIVATE';
comment on column public.organizations.contact_email       is 'PRIVATE';
comment on column public.organizations.contact_phone       is 'PRIVATE';
comment on column public.organizations.address_line        is 'PRIVATE';

-- ---------------------------------------------------------------------------
-- people — leaders, workers, verifiers, beneficiaries. Private by default.
-- Only display_name + role_title may appear publicly, and only when
-- public_profile = true. Beneficiaries are never given a public profile.
-- ---------------------------------------------------------------------------
create table public.people (
  id             uuid primary key default gen_random_uuid(),
  display_name   text not null,
  role_title     text,
  public_profile boolean not null default false,
  is_beneficiary boolean not null default false,
  -- PRIVATE
  full_name      text,
  email          text,
  phone          text,
  address        text,
  notes          text,
  created_at     timestamptz not null default now(),
  constraint beneficiaries_never_public
    check (not (is_beneficiary and public_profile))
);

comment on table  public.people         is 'Private by default; see docs/data-model.md';
comment on column public.people.full_name is 'PRIVATE';
comment on column public.people.email     is 'PRIVATE';
comment on column public.people.phone     is 'PRIVATE';
comment on column public.people.address   is 'PRIVATE';
comment on column public.people.notes     is 'PRIVATE';

-- ---------------------------------------------------------------------------
-- projects — the passport itself
-- ---------------------------------------------------------------------------
create type public.project_status     as enum ('planned', 'active', 'completed', 'paused');
create type public.project_visibility as enum ('private', 'public');

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  country         text,
  region          text,
  need_statement  text,
  objectives      text[] not null default '{}',
  status          public.project_status not null default 'planned',
  start_date      date,
  end_date        date,
  base_currency   char(3) not null default 'USD'
                    check (base_currency ~ '^[A-Z]{3}$'),
  visibility      public.project_visibility not null default 'private',
  created_at      timestamptz not null default now(),
  constraint project_dates_ordered
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index projects_organization_id_idx on public.projects (organization_id);

comment on column public.projects.base_currency is
  'ISO 4217 reporting currency; money rows keep original currency + exchange_rate';

-- ---------------------------------------------------------------------------
-- project_leaders — who is responsible for a project
-- ---------------------------------------------------------------------------
create type public.leader_role as enum ('local_lead', 'treasurer', 'board', 'staff', 'other');

create table public.project_leaders (
  project_id uuid not null references public.projects(id) on delete cascade,
  person_id  uuid not null references public.people(id)   on delete restrict,
  role       public.leader_role not null,
  since      date,
  primary key (project_id, person_id, role)
);

create index project_leaders_person_id_idx on public.project_leaders (person_id);

-- Beneficiaries cannot be recorded as project leaders.
create function public.project_leaders_reject_beneficiary()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.people p where p.id = new.person_id and p.is_beneficiary) then
    raise exception 'A beneficiary cannot be recorded as a project leader';
  end if;
  return new;
end;
$$;

create trigger project_leaders_reject_beneficiary
  before insert or update on public.project_leaders
  for each row execute function public.project_leaders_reject_beneficiary();

-- ---------------------------------------------------------------------------
-- Lock everything down until item 8 adds policies and public_* views.
-- ---------------------------------------------------------------------------
alter table public.organizations   enable row level security;
alter table public.people          enable row level security;
alter table public.projects        enable row level security;
alter table public.project_leaders enable row level security;
