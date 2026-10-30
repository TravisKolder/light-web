-- Migration 003a: budget lines and funds received
-- See docs/data-model.md §2 "Budget and ledger (migration 003)".
--
-- Backlog item 5a. Suppliers, purchases, and payments come in 5b, along with
-- extending the verifier-independence check to donors and supplier contacts.
--
-- Currency rule (Travis, 2026-10-25): every money row keeps the amount in its
-- ORIGINAL currency plus the exchange rate used to convert it to the
-- project's base_currency. amount_base is generated and never typed in.
-- When currency = base_currency the rate must be exactly 1 (trigger below).
--
-- Money here is only RECORDED. Nothing in this app moves, collects, or
-- solicits funds.
--
-- Privacy: RLS is enabled with NO policies (same as earlier migrations).
-- Donor identity columns on funds_received are PRIVATE and will never be
-- exposed by the public_* views (item 8).

-- ---------------------------------------------------------------------------
-- Shared bits
-- ---------------------------------------------------------------------------
create type public.rate_source as enum
  ('same_currency', 'bank', 'central_bank', 'mobile_money', 'manual');

-- Lets money rows require that their assertion belongs to the same project.
alter table public.assertions
  add constraint assertions_id_project_key unique (id, project_id);

-- ---------------------------------------------------------------------------
-- budget_lines — the approved budget, one row per line
-- ---------------------------------------------------------------------------
create table public.budget_lines (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  category             text not null check (length(btrim(category)) > 0),
  description          text,
  approved_amount      numeric(14, 2) not null check (approved_amount >= 0),
  currency             char(3) not null check (currency ~ '^[A-Z]{3}$'),
  exchange_rate        numeric(18, 8) not null check (exchange_rate > 0),
  rate_date            date not null,
  rate_source          public.rate_source not null,
  approved_amount_base numeric(16, 2)
                         generated always as (round(approved_amount * exchange_rate, 2)) stored,
  approved_on          date,
  assertion_id         uuid,
  created_at           timestamptz not null default now(),
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete set null (assertion_id)
);

create index budget_lines_project_idx on public.budget_lines(project_id);

comment on column public.budget_lines.approved_amount_base is
  'approved_amount converted to projects.base_currency; totals use this';

-- ---------------------------------------------------------------------------
-- funds_received — money the project recorded as received
-- ---------------------------------------------------------------------------
create type public.funds_source_category as enum
  ('individual', 'church', 'foundation', 'local', 'other');

create table public.funds_received (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  amount           numeric(14, 2) not null check (amount > 0),
  currency         char(3) not null check (currency ~ '^[A-Z]{3}$'),
  exchange_rate    numeric(18, 8) not null check (exchange_rate > 0),
  rate_date        date not null,
  rate_source      public.rate_source not null,
  amount_base      numeric(16, 2)
                     generated always as (round(amount * exchange_rate, 2)) stored,
  received_on      date not null,
  source_category  public.funds_source_category not null,
  assertion_id     uuid,
  -- PRIVATE: donor identity. Never in public views.
  donor_person_id  uuid references public.people(id) on delete set null,
  donor_name       text,
  donor_contact    text,
  donor_reference  text,
  created_at       timestamptz not null default now(),
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete set null (assertion_id)
);

create index funds_received_project_idx on public.funds_received(project_id);

comment on column public.funds_received.donor_person_id is 'PRIVATE';
comment on column public.funds_received.donor_name      is 'PRIVATE';
comment on column public.funds_received.donor_contact   is 'PRIVATE';
comment on column public.funds_received.donor_reference is 'PRIVATE';

-- ---------------------------------------------------------------------------
-- Same-currency rule: rate is 1 and source is 'same_currency' exactly when
-- the row's currency equals the project's base_currency.
-- ---------------------------------------------------------------------------
create function public.money_rows_check_rate()
returns trigger language plpgsql as $$
declare
  v_base char(3);
begin
  select p.base_currency into v_base
    from public.projects p where p.id = new.project_id;

  if new.currency = v_base then
    if new.exchange_rate <> 1 or new.rate_source <> 'same_currency' then
      raise exception 'Same currency as project base (%): exchange_rate must be 1 and rate_source same_currency', v_base;
    end if;
  elsif new.rate_source = 'same_currency' then
    raise exception 'Currency % differs from project base %: give a real rate source', new.currency, v_base;
  end if;

  return new;
end;
$$;

create trigger budget_lines_check_rate
  before insert or update on public.budget_lines
  for each row execute function public.money_rows_check_rate();

create trigger funds_received_check_rate
  before insert or update on public.funds_received
  for each row execute function public.money_rows_check_rate();

alter table public.budget_lines   enable row level security;
alter table public.funds_received enable row level security;
