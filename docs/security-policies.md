# Security policies: who can read and write what

Written for backlog item 22b (2026-11-17). Source of truth is the SQL in
`supabase/migrations/`; this page explains it. If you change a grant, a
policy or a `public_*` view, update this page **and**
`scripts/check-anon-access.mjs` in the same change.

## Roles

| Role | Who | How they reach the data |
| --- | --- | --- |
| `anon` | Anyone not signed in (every public visitor, and the anon key in the browser) | `public_*` views only |
| `authenticated` (non-editor) | Someone who signed in by magic link but is not in `public.editors` | Table privileges exist, but RLS returns no rows and rejects every write |
| `authenticated` + in `public.editors` | Pilot editors (Travis, John) | Full read/write on Passport base tables through RLS policy `editors_all` |
| `service_role` / database owner | Supabase dashboard and SQL editor only | Bypasses RLS. **Never** used by the app; the key is not in the repo, `.env.example` or Vercel |

The app has no `service_role` code path. Pages read with the anon key; the
editor area uses the signed-in user's session, so RLS applies to every query.

## Base tables

All 21 tables have RLS enabled. `anon` has **no** privileges on any of them
(revoked explicitly in migration 013, since newer Supabase projects grant
API roles access to new tables by default).

| Table | anon | authenticated, not editor | editor | Why |
| --- | --- | --- | --- | --- |
| `organizations`, `people`, `projects`, `project_leaders` | none | 0 rows; writes rejected | select / insert / update / delete | People hold private contacts; projects may be `visibility = 'private'` |
| `assertions`, `documents`, `verifications` | none | 0 rows; writes rejected | select / insert / update / delete | `status` is set only by triggers (migration 003/011), never by the form; verifier independence is enforced by trigger |
| `budget_lines`, `funds_received`, `suppliers`, `purchases`, `payments` | none | 0 rows; writes rejected | select / insert / update / delete | Donor identity, supplier contacts/bank note and payment references are private. Money is only recorded, never moved |
| `evidence_items`, `progress_reports`, `outcomes`, `lessons`, `sustainability_plans` | none | 0 rows; writes rejected | select / insert / update / delete | Evidence holds private GPS and photos of identifiable people |
| `kingdom_return_entries`, `kingdom_return_links` | none | 0 rows; writes rejected | select / insert / update / delete | Narrative only; no score column exists |
| `editors` | none | 0 rows | **select only** | Editors can see who the editors are; nobody can change the list through the API (add/remove in the Supabase SQL editor) |
| `audit_log` | none | 0 rows | **select only** | Append-only change history (migration 014). Written only by triggers; a guard trigger refuses update/delete/truncate for every role. Rows hold whole old/new rows including private columns, so it must never feed a public view |

"Editor" means `public.is_editor()` is true: a `security definer` function
with an empty `search_path` that checks `auth.uid()` against
`public.editors`. Policy on each Passport table:
`for all to authenticated using (is_editor()) with check (is_editor())`.

Known gap, planned: there is no audit trail of editor changes yet (22c adds
an append-only `audit_log`). Editors can also delete rows; that stays until
roles are scoped per organization.

## Public views

All `public_*` views run with the view owner's rights
(`security_invoker = false`) so anon can read them without base-table
access, and use `security_barrier = true` so a caller's filters can't
peek at hidden rows. Each one shows only rows of projects with
`visibility = 'public'`. `anon` and `authenticated` get **select only**;
nothing can insert, update or delete through a view.

| View | Columns exposed | Deliberately left out |
| --- | --- | --- |
| `public_projects` | id, slug, title, organization_id, country, region, need_statement, objectives, status, start_date, end_date, base_currency, created_at, timezone, is_sample | private projects; visibility |
| `public_organizations` | id, name, country, region, description, website | registration_number, contact_email, contact_phone, address_line; orgs with no public project |
| `public_project_leaders` | project_id, role, since, display_name\*, role_title\* | person id, full_name, email, phone, address, notes |
| `public_assertions` | id, project_id, statement, status, asserted_on, asserted_by_name\* | asserted_by person id |
| `public_budget_lines` | id, project_id, category, description, approved_amount, currency, exchange_rate, rate_date, rate_source, approved_amount_base, approved_on, assertion_id | — |
| `public_funds_received` | id, project_id, amount, currency, exchange_rate, rate_date, rate_source, amount_base, received_on, source_category, assertion_id | **donor identity**: donor_person_id, donor_name, donor_contact, donor_reference |
| `public_purchases` | id, project_id, budget_line_id, supplier_name, supplier_kind, supplier_country, supplier_region, description, quantity, unit, amount, currency, exchange_rate, rate_date, rate_source, amount_base, purchased_on, assertion_id | supplier contact_person_id, contact_name, contact_phone, contact_email, bank_details_note |
| `public_payments` | id, project_id, purchase_id, amount, currency, exchange_rate, rate_date, rate_source, amount_base, paid_on, method, assertion_id | **reference_number** (transaction ids) |
| `public_budget_vs_actual` | budget_line_id, project_id, category, approved_amount_base, spent_base, remaining_base, assertion_id | — |
| `public_documents` | id, project_id, assertion_id, kind, title, issued_on, contains_personal_data, storage_path (null when `contains_personal_data`) | uploaded_by; file path of personal-data documents |
| `public_verifications` | id, project_id, assertion_id, verifier_name\*, independence_declared_on, verified_on, method, finding, tie_flagged | verifier_id, independence_declaration text, notes, tie_flag_note |
| `public_evidence` | id, project_id, assertion_id, kind, caption, captured_on, location_label, storage_path | **GPS**, uploaded_by; whole rows where `shows_identifiable_people` |
| `public_progress_reports` | id, project_id, period_start, period_end, summary, setbacks, assertion_id, author_name\* | author person id |
| `public_outcomes` | id, project_id, description, measure, target, achieved, assertion_id | — |
| `public_lessons` | id, project_id, lesson, recorded_on | created_at |
| `public_sustainability_plans` | id, project_id, plan, funding_after_grant, local_owner, review_on | — |
| `public_kingdom_return_entries` | id, project_id, dimension, narrative, recorded_on, author_name\* | author person id |
| `public_kingdom_return_links` | id, project_id, entry_id, assertion_id, evidence_item_id | links to hidden evidence |

\* Name/title only when that person set `public_profile = true`; otherwise null.

## Functions callable over the API

Postgres grants `EXECUTE` on new functions to everyone by default, so
anything in `public` can be called at `/rest/v1/rpc/<name>`.

| Function | Callable by anon? | Effect |
| --- | --- | --- |
| `is_editor()` | yes (granted on purpose) | Returns false for anon; true only for editors. Reveals nothing else |
| `is_valid_timezone(text)`, `project_today(uuid)` | no (signed-in only) | Migration 015. `project_today` runs as the caller, so RLS still applies: non-editors get null |
| `record_audit()`, `audit_log_is_append_only()`, `assertions_default_asserted_on()` | no | Trigger functions; execute revoked from API roles |
| `compute_assertion_status(uuid)` | callable, but refused | Runs as the caller (not `security definer`), so anon gets "permission denied" on the base tables |
| trigger functions (`*_derive_status`, `refresh_assertion_status`, `verifications_require_independence`, `money_rows_check_rate`, `project_leaders_reject_beneficiary`) | no | Return `trigger`, which the API can't call |

## Rules for new tables, views and functions

1. A new table: enable RLS, add it to the `editors_all` policy loop and to the
   anon revoke in a new migration, and add it to `BASE_TABLES` in
   `scripts/check-anon-access.mjs`.
2. A new `public_*` view: `security_barrier = true, security_invoker = false`,
   filter to public projects, grant `select` only, list its columns here and in
   `PUBLIC_VIEWS` in the check script, then run
   `supabase/checks/public_views_no_private_columns.sql`.
3. A new function: prefer `security invoker`. If it must be `security definer`,
   set `search_path = ''` and `revoke execute ... from public` unless anon
   really needs it.

## How to check

- `npm run check:anon-access` — live, against the Supabase project in
  `NEXT_PUBLIC_SUPABASE_URL` with the **anon** key. Reads only; refuses to
  run with a service/secret key. Prints SKIPPED without the env vars.
- `npm run build && npm run check:public-page` — no private sample value in the
  public passport's HTML **or** its React Server Components payload.
- `supabase/checks/public_views_no_private_columns.sql` — run in the SQL editor
  after migrating.

### Server-rendered payload (22b, 2026-11-17)

Every passport component (`app/components/passport/*`) is a Server
Component; the only `"use client"` file in the app is `app/error.tsx`. So the
rows loaded from the views are rendered on the server and are **not** sent to
the browser as data: the RSC payload carries only the rendered output. A few
view columns are loaded but not shown (ids, `storage_path`), and they stay on
the server for the same reason. If a client component is ever added to the
passport, pass it only the fields it displays.
