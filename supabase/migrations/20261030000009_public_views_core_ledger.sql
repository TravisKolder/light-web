-- Migration 006a: public read views — project, organization, leaders,
-- assertions, and the ledger
-- See docs/data-model.md §3 "Privacy model".
--
-- Backlog item 8a. Item 8b adds the evidence / documents / verifications /
-- reports / outcomes / Kingdom Return views and an automated leak check.
--
-- How the privacy model works:
--   * Every base table has RLS enabled with NO policies, so the `anon` and
--     `authenticated` roles can't read base tables directly.
--   * Public reads go through these public_* views. They run with the view
--     owner's rights (security_invoker = false), select ONLY non-private
--     columns, and ONLY rows whose project has visibility = 'public'.
--   * security_barrier = true stops a caller's filter functions from
--     seeing rows the view would hide.
--   * Never add a PRIVATE column (see column comments) to a public_* view.
--
-- Money is shown as recorded: original amount, currency, rate, rate source,
-- and base amount. Donor identity, supplier contacts, and payment reference
-- numbers are never included.

-- ---------------------------------------------------------------------------
-- public_projects
-- ---------------------------------------------------------------------------
create view public.public_projects
with (security_barrier = true, security_invoker = false) as
select p.id, p.slug, p.title, p.organization_id, p.country, p.region,
       p.need_statement, p.objectives, p.status, p.start_date, p.end_date,
       p.base_currency, p.created_at
  from public.projects p
 where p.visibility = 'public';

-- ---------------------------------------------------------------------------
-- public_organizations — only organizations with at least one public project
-- (registration number, contact email/phone, address excluded)
-- ---------------------------------------------------------------------------
create view public.public_organizations
with (security_barrier = true, security_invoker = false) as
select o.id, o.name, o.country, o.region, o.description, o.website
  from public.organizations o
 where exists (select 1 from public.projects p
               where p.organization_id = o.id and p.visibility = 'public');

-- ---------------------------------------------------------------------------
-- public_project_leaders — role is always shown; name and title only when
-- the person has opted into a public profile. No contact details ever.
-- ---------------------------------------------------------------------------
create view public.public_project_leaders
with (security_barrier = true, security_invoker = false) as
select pl.project_id,
       pl.role,
       pl.since,
       case when pe.public_profile then pe.display_name end as display_name,
       case when pe.public_profile then pe.role_title   end as role_title
  from public.project_leaders pl
  join public.projects p on p.id = pl.project_id and p.visibility = 'public'
  join public.people pe  on pe.id = pl.person_id;

-- ---------------------------------------------------------------------------
-- public_assertions — statement + status (the badge). Who asserted it is
-- shown only for public profiles.
-- ---------------------------------------------------------------------------
create view public.public_assertions
with (security_barrier = true, security_invoker = false) as
select a.id, a.project_id, a.statement, a.status, a.asserted_on,
       case when pe.public_profile then pe.display_name end as asserted_by_name
  from public.assertions a
  join public.projects p on p.id = a.project_id and p.visibility = 'public'
  left join public.people pe on pe.id = a.asserted_by;

-- ---------------------------------------------------------------------------
-- Ledger views
-- ---------------------------------------------------------------------------
create view public.public_budget_lines
with (security_barrier = true, security_invoker = false) as
select b.id, b.project_id, b.category, b.description,
       b.approved_amount, b.currency, b.exchange_rate, b.rate_date,
       b.rate_source, b.approved_amount_base, b.approved_on, b.assertion_id
  from public.budget_lines b
  join public.projects p on p.id = b.project_id and p.visibility = 'public';

-- Amount, date, and source category only. NO donor identity.
create view public.public_funds_received
with (security_barrier = true, security_invoker = false) as
select f.id, f.project_id, f.amount, f.currency, f.exchange_rate,
       f.rate_date, f.rate_source, f.amount_base, f.received_on,
       f.source_category, f.assertion_id
  from public.funds_received f
  join public.projects p on p.id = f.project_id and p.visibility = 'public';

-- Supplier name, kind, and place only. NO contact or bank details.
create view public.public_purchases
with (security_barrier = true, security_invoker = false) as
select pu.id, pu.project_id, pu.budget_line_id,
       s.name as supplier_name, s.kind as supplier_kind,
       s.country as supplier_country, s.region as supplier_region,
       pu.description, pu.quantity, pu.unit,
       pu.amount, pu.currency, pu.exchange_rate, pu.rate_date,
       pu.rate_source, pu.amount_base, pu.purchased_on, pu.assertion_id
  from public.purchases pu
  join public.projects p on p.id = pu.project_id and p.visibility = 'public'
  left join public.suppliers s on s.id = pu.supplier_id;

-- NO reference_number (transaction IDs).
create view public.public_payments
with (security_barrier = true, security_invoker = false) as
select pa.id, pa.project_id, pa.purchase_id,
       pa.amount, pa.currency, pa.exchange_rate, pa.rate_date,
       pa.rate_source, pa.amount_base, pa.paid_on, pa.method, pa.assertion_id
  from public.payments pa
  join public.projects p on p.id = pa.project_id and p.visibility = 'public';

-- Budget vs actual per line, in base currency.
-- spent = sum of payments on the line's purchases.
create view public.public_budget_vs_actual
with (security_barrier = true, security_invoker = false) as
select b.id as budget_line_id, b.project_id, b.category,
       b.approved_amount_base,
       coalesce(sum(pa.amount_base), 0)                          as spent_base,
       b.approved_amount_base - coalesce(sum(pa.amount_base), 0) as remaining_base,
       b.assertion_id
  from public.budget_lines b
  join public.projects p on p.id = b.project_id and p.visibility = 'public'
  left join public.purchases pu on pu.budget_line_id = b.id
  left join public.payments  pa on pa.purchase_id = pu.id
 group by b.id;

-- ---------------------------------------------------------------------------
-- Grants (Supabase roles). Base tables stay unreadable via RLS.
-- ---------------------------------------------------------------------------
grant select on
  public.public_projects, public.public_organizations,
  public.public_project_leaders, public.public_assertions,
  public.public_budget_lines, public.public_funds_received,
  public.public_purchases, public.public_payments,
  public.public_budget_vs_actual
to anon, authenticated;
