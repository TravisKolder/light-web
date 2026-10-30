-- Migration 003b: suppliers, purchases, payments
-- See docs/data-model.md §2 "Budget and ledger (migration 003)".
--
-- Backlog item 5b. Same currency rule as 003a (original amount + rate +
-- generated base amount; same-currency trigger reused).
--
-- Money here is only RECORDED. Nothing in this app moves, collects, or
-- solicits funds.
--
-- Privacy: RLS is enabled with NO policies. Supplier contact details and
-- payment reference numbers are PRIVATE.
--
-- Also extends the verifier-independence check (migration 002b) to donors
-- of the project and contacts of suppliers the project bought from.

-- ---------------------------------------------------------------------------
-- suppliers — vendors a project bought from (shared across projects)
-- ---------------------------------------------------------------------------
create type public.supplier_kind as enum
  ('business', 'individual', 'cooperative', 'government', 'other');

create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(btrim(name)) > 0),
  kind               public.supplier_kind not null default 'business',
  country            text,
  region             text,
  -- PRIVATE
  contact_person_id  uuid references public.people(id) on delete set null,
  contact_name       text,
  contact_phone      text,
  contact_email      text,
  bank_details_note  text,
  created_at         timestamptz not null default now()
);

comment on column public.suppliers.contact_person_id is 'PRIVATE';
comment on column public.suppliers.contact_name      is 'PRIVATE';
comment on column public.suppliers.contact_phone     is 'PRIVATE';
comment on column public.suppliers.contact_email     is 'PRIVATE';
comment on column public.suppliers.bank_details_note is 'PRIVATE';

-- Lets purchases require a budget line from the same project.
alter table public.budget_lines
  add constraint budget_lines_id_project_key unique (id, project_id);

-- ---------------------------------------------------------------------------
-- purchases — what was bought, against which budget line, from whom
-- ---------------------------------------------------------------------------
create table public.purchases (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  budget_line_id  uuid not null,
  supplier_id     uuid references public.suppliers(id) on delete restrict,
  description     text not null check (length(btrim(description)) > 0),
  quantity        numeric(14, 3) check (quantity is null or quantity > 0),
  unit            text,
  amount          numeric(14, 2) not null check (amount >= 0),
  currency        char(3) not null check (currency ~ '^[A-Z]{3}$'),
  exchange_rate   numeric(18, 8) not null check (exchange_rate > 0),
  rate_date       date not null,
  rate_source     public.rate_source not null,
  amount_base     numeric(16, 2)
                    generated always as (round(amount * exchange_rate, 2)) stored,
  purchased_on    date not null,
  assertion_id    uuid,
  created_at      timestamptz not null default now(),
  unique (id, project_id),
  foreign key (budget_line_id, project_id)
    -- no action (checked at end of statement): blocks deleting a line that
    -- has purchases, but lets a project delete cascade cleanly.
    references public.budget_lines(id, project_id) on delete no action,
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete set null (assertion_id)
);

create index purchases_project_idx     on public.purchases(project_id);
create index purchases_budget_line_idx on public.purchases(budget_line_id);
create index purchases_supplier_idx    on public.purchases(supplier_id);

-- ---------------------------------------------------------------------------
-- payments — money recorded as paid against a purchase
-- project_id is carried so the same-project and same-currency rules apply.
-- ---------------------------------------------------------------------------
create type public.payment_method as enum
  ('bank_transfer', 'mobile_money', 'cash', 'check');

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  purchase_id       uuid not null,
  amount            numeric(14, 2) not null check (amount > 0),
  currency          char(3) not null check (currency ~ '^[A-Z]{3}$'),
  exchange_rate     numeric(18, 8) not null check (exchange_rate > 0),
  rate_date         date not null,
  rate_source       public.rate_source not null,
  amount_base       numeric(16, 2)
                      generated always as (round(amount * exchange_rate, 2)) stored,
  paid_on           date not null,
  method            public.payment_method not null,
  assertion_id      uuid,
  -- PRIVATE: transaction IDs
  reference_number  text,
  created_at        timestamptz not null default now(),
  foreign key (purchase_id, project_id)
    references public.purchases(id, project_id) on delete cascade,
  foreign key (assertion_id, project_id)
    references public.assertions(id, project_id) on delete set null (assertion_id)
);

create index payments_project_idx  on public.payments(project_id);
create index payments_purchase_idx on public.payments(purchase_id);

comment on column public.payments.reference_number is 'PRIVATE';

create trigger purchases_check_rate
  before insert or update on public.purchases
  for each row execute function public.money_rows_check_rate();

create trigger payments_check_rate
  before insert or update on public.payments
  for each row execute function public.money_rows_check_rate();

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.payments  enable row level security;

-- ---------------------------------------------------------------------------
-- Verifier independence: add donors and supplier contacts
-- (replaces the function from migration 002b; trigger unchanged)
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

  return new;
end;
$$;
