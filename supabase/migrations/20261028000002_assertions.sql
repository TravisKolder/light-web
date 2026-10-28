-- Migration 002: assertions, documents, verifications (tables only)
-- See docs/data-model.md §1 (three-state rule) and §2 "Assertions and proof".
--
-- This migration creates the tables, enums, and simple constraints.
-- The status-enforcement trigger and the verifier-independence trigger come
-- in the next migration (backlog item 4b). Until then, `assertions.status`
-- defaults to 'claim' and nothing in the app should set it by hand.
--
-- The three states are kept separate on purpose:
--   claim       = someone said it
--   documented  = at least one supporting document is attached
--   verified    = an independent person checked it and confirmed it
-- A document is never a verification.
--
-- Privacy: RLS is enabled with NO policies (same as migration 001).

-- ---------------------------------------------------------------------------
-- assertions — any factual statement a project makes
-- ---------------------------------------------------------------------------
create type public.assertion_status as enum ('claim', 'documented', 'verified');

create table public.assertions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  statement   text not null check (length(btrim(statement)) > 0),
  asserted_by uuid references public.people(id) on delete restrict,
  asserted_on date not null default current_date,
  status      public.assertion_status not null default 'claim',
  created_at  timestamptz not null default now()
);

create index assertions_project_idx on public.assertions(project_id);

comment on column public.assertions.status is
  'Enforced by trigger (item 4b): documented needs >=1 document; verified needs a confirmed, independent, unflagged verification.';

-- ---------------------------------------------------------------------------
-- documents — supporting material for an assertion (NOT a verification)
-- ---------------------------------------------------------------------------
create type public.document_kind as enum
  ('receipt', 'invoice', 'photo', 'report', 'contract', 'bank_statement', 'other');

create table public.documents (
  id                     uuid primary key default gen_random_uuid(),
  assertion_id           uuid not null references public.assertions(id) on delete cascade,
  kind                   public.document_kind not null,
  title                  text not null,
  issued_on              date,
  uploaded_by            uuid references public.people(id) on delete restrict,
  contains_personal_data boolean not null default false,
  -- PRIVATE when contains_personal_data = true (public views show kind/title only)
  storage_path           text,
  created_at             timestamptz not null default now()
);

create index documents_assertion_idx on public.documents(assertion_id);

comment on column public.documents.storage_path is
  'PRIVATE when contains_personal_data = true';

-- ---------------------------------------------------------------------------
-- verifications — an independent check of one assertion
-- There is no "affiliated" type: a connected person's review is recorded as
-- a document instead.
-- ---------------------------------------------------------------------------
create type public.verification_method as enum
  ('site_visit', 'document_review', 'third_party_audit',
   'photo_geolocation', 'interview', 'other');

create type public.verification_finding as enum
  ('confirmed', 'not_confirmed', 'disputed');

create table public.verifications (
  id                       uuid primary key default gen_random_uuid(),
  assertion_id             uuid not null references public.assertions(id) on delete cascade,
  verifier_id              uuid not null references public.people(id) on delete restrict,
  independence_declaration text not null
                             check (length(btrim(independence_declaration)) > 0),
  independence_declared_on date not null,
  verified_on              date not null,
  method                   public.verification_method not null,
  finding                  public.verification_finding not null,
  notes                    text,
  -- Set when a tie to the project is discovered later. A flagged
  -- verification shows as "needs review" and stops counting toward verified.
  tie_flagged              boolean not null default false,
  tie_flag_note            text,
  created_at               timestamptz not null default now(),
  constraint declaration_not_after_verification
    check (independence_declared_on <= verified_on),
  constraint tie_flag_needs_note
    check (not tie_flagged or tie_flag_note is not null)
);

create index verifications_assertion_idx on public.verifications(assertion_id);
create index verifications_verifier_idx  on public.verifications(verifier_id);

comment on column public.verifications.tie_flag_note is
  'Why the verification was flagged. Reviewer-facing; not shown publicly.';

-- ---------------------------------------------------------------------------
-- RLS on, no policies yet (item 8 adds them).
-- ---------------------------------------------------------------------------
alter table public.assertions    enable row level security;
alter table public.documents     enable row level security;
alter table public.verifications enable row level security;
