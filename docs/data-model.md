# Project Passport — Data Model

Design reference for the Supabase migrations (backlog items 3–8). Based on
sections 4, 6 and 7 of `light-web-proposal-john-gross.txt`.

Money in this model is **recorded only** — nothing here moves, collects, or
solicits funds. There are no token, wallet, or payment-processing fields.

## 1. The three-state rule (claim / documented / verified)

Every factual statement a project makes ("the roof was completed", "we
received $4,000 in March", "Supplier X delivered 200 bags of cement") is an
**assertion**. Each assertion has exactly one status:

| Status       | Meaning                                                    | Requires |
|--------------|------------------------------------------------------------|----------|
| `claim`      | Someone said it. Nothing attached yet.                     | statement text + who asserted it |
| `documented` | At least one supporting document is attached.              | ≥ 1 `documents` row |
| `verified`   | An independent party checked it and confirmed it.          | ≥ 1 `verifications` row with `finding = 'confirmed'` by a verifier independent of the project |

Rules:

- The three states are never merged. A document is not a verification; a
  verification always names who checked, when, and how.
- Status is stored on `assertions.status` but **enforced by a trigger**: it
  cannot be set to `documented` without a document, or to `verified` without
  a confirmed independent verification. Removing the supporting row drops the
  status back down.
  (Implemented in `supabase/migrations/20261029000003_assertion_triggers.sql`:
  any value written to `status` is ignored and re-derived.)
- A verification with `finding = 'not_confirmed'` or `'disputed'` does not
  raise status; the assertion is shown as **needs review** (never as "false"
  or "fraud").
- "Independent" means the verifier has **nothing to do with the project at
  all** (decided by Travis, 2026-10-25). They may not be a leader, staff
  member, or board member of the responsible organization; a donor to the
  project; a supplier or supplier contact; anyone paid by the project; the
  person who made the assertion or uploaded its documents; or a beneficiary.
  - The insert trigger on `verifications` **rejects** any verifier who
    appears anywhere in that project's records (`project_leaders`,
    `assertions.asserted_by`, `documents.uploaded_by`,
    `funds_received.donor_person_id`, `suppliers.contact_person_id`,
    `progress_reports.author_id`, `kingdom_return_entries.author_id`).
  - Ties the database can't see (family, friendship, employment elsewhere)
    are covered by a required `independence_declaration` the verifier
    attests to on each verification.
  - If a tie is discovered later, the verification is flagged **needs
    review** and stops counting toward `verified`.
- Every other record that states a fact (budget line, funds received,
  purchase, payment, evidence item, outcome, Kingdom Return entry) links to
  an assertion via `assertion_id`, so the UI can show a status badge on it.

## 2. Entities

`P` = private by default (never in public views). Everything else is public
only if the parent project has `visibility = 'public'`.

### Core (migration 001)

**organizations** — responsible ministry or partner.
`id, name, country, region, description, website, created_at`
P: `registration_number, contact_email, contact_phone, address_line`

**people** — anyone involved (leaders, workers, verifiers, beneficiaries).
Private by default.
`id, display_name, role_title, public_profile (bool, default false),
is_beneficiary (bool, default false), created_at`
P: `full_name, email, phone, address, notes`
Only `display_name` + `role_title` appear publicly, and only when
`public_profile = true`. Beneficiaries are never given a public profile
(enforced by a check constraint on `is_beneficiary`), and cannot be project
leaders (trigger).

**projects** — the passport itself.
`id, slug, title, organization_id, country, region, need_statement,
objectives (text[]), status ('planned' | 'active' | 'completed' | 'paused'),
start_date, end_date, base_currency (ISO 4217, reporting currency),
visibility ('private' | 'public'), created_at`

**project_leaders** — link table.
`project_id, person_id, role ('local_lead' | 'treasurer' | 'board' | 'staff' | 'other'), since`

### Assertions and proof (migration 002)

**assertions** — `id, project_id, statement, asserted_by (person_id),
asserted_on, status, created_at`

**documents** — supporting material for an assertion.
`id, assertion_id, kind ('receipt' | 'invoice' | 'photo' | 'report' |
'contract' | 'bank_statement' | 'other'), title, storage_path, issued_on,
uploaded_by (person_id), contains_personal_data (bool, default false), created_at`
P: `storage_path` for any document marked `contains_personal_data = true`
(e.g. bank statements, IDs). Public views show the document's kind/title only.

**verifications** — `id, assertion_id, verifier_id (person_id),
independence_declaration (text, required), independence_declared_on,
verified_on,
method ('site_visit' | 'document_review' | 'third_party_audit' |
'photo_geolocation' | 'interview' | 'other'), finding ('confirmed' |
'not_confirmed' | 'disputed'), notes, tie_flagged (bool, default false),
tie_flag_note (required when flagged; reviewer-facing only), created_at`
`independence_declared_on` may not be after `verified_on`.
There is no "affiliated" verification type: a connected person's review is
not a verification. Their input can be recorded as a document instead.

### Budget and ledger (migration 003)

**Currency rule** (decided by Travis, 2026-10-25): every money row keeps
the amount **in its original currency** plus the exchange rate used to
convert it to the project's `base_currency`. Each money row has:
`amount, currency (ISO 4217), exchange_rate (base units per 1 original
unit), rate_date, rate_source ('same_currency' | 'bank' | 'central_bank' |
'mobile_money' | 'manual')`, and a generated `amount_base = amount *
exchange_rate` (rounded to 2 places). When `currency = base_currency`,
`exchange_rate = 1` and `rate_source = 'same_currency'`; otherwise a real
source is required (trigger). A money row's `assertion_id` must belong to
the same project (composite foreign key). The original amount is
never overwritten; totals and budget-vs-actual use `amount_base`. The rate
and its source are part of the record so a reviewer can check it.

**budget_lines** — `id, project_id, category, description, approved_amount,
currency, exchange_rate, rate_date, rate_source, approved_amount_base,
approved_on, assertion_id`

**funds_received** — `id, project_id, amount, currency, exchange_rate,
rate_date, rate_source, amount_base, received_on,
source_category ('individual' | 'church' | 'foundation' | 'local' | 'other'),
assertion_id`
P: `donor_person_id, donor_name, donor_contact, donor_reference`. Public views show amount,
date, and source category only — never donor identity.

**suppliers** — `id, name, kind ('business' | 'individual' | 'cooperative' |
'government' | 'other'), country, region` (shared across projects)
P: `contact_person_id, contact_name, contact_phone, contact_email,
bank_details_note`

**purchases** — `id, project_id, budget_line_id, supplier_id, description,
quantity, unit, amount, currency, exchange_rate, rate_date, rate_source,
amount_base, purchased_on, assertion_id`

**payments** — `id, project_id, purchase_id, amount, currency, exchange_rate,
rate_date, rate_source, amount_base, paid_on, method ('bank_transfer' |
'mobile_money' | 'cash' | 'check'), assertion_id`
P: `reference_number` (transaction IDs).
A purchase's budget line and a payment's purchase must belong to the same
project (composite foreign keys). A budget line with purchases can't be
deleted.

Budget-vs-actual is computed: spent per line = sum of payments on that line's
purchases (`amount_base`); remaining = approved − spent, all in
`base_currency`. Views also show original amounts and rates.

### Delivery and results (migration 004)

**evidence_items** — physical-world proof of delivery.
`id, project_id, assertion_id, kind ('photo' | 'video' | 'receipt' |
'site_report' | 'other'), caption, captured_on, location_label, storage_path,
shows_identifiable_people`
P: `gps_lat, gps_lng` (precise location can endanger people; public shows
`location_label` only), and any item flagged `shows_identifiable_people`
(excluded from public views entirely).
`assertion_id` is required and must be in the same project. An evidence item
does **not** change the assertion's status by itself; only documents and
independent verifications do.

**progress_reports** — `id, project_id, period_start, period_end, summary,
setbacks, author_id, assertion_id`

**outcomes** — `id, project_id, description, measure, target, achieved,
assertion_id`
`target` and `achieved` are free text (e.g. "120 pupils enrolled"), not
scores.

**lessons** — `id, project_id, lesson, recorded_on`

**sustainability_plans** — `id, project_id, plan, funding_after_grant,
local_owner (text), review_on`

### Kingdom Return (migration 005)

**kingdom_return_entries** — `id, project_id, dimension ('multiplication' |
'subtraction' | 'stewardship' | 'sustainability' | 'restoration'),
narrative, recorded_on, author_id`
**kingdom_return_links** — `id, project_id, entry_id, assertion_id |
evidence_item_id` (exactly one target, same project as the entry, no
duplicates)

There is deliberately **no score, rating, or numeric column**. Each dimension
is narrative plus linked evidence, per section 6: fruit is documented, not
reduced to a number.

| Dimension      | Question it answers |
|----------------|---------------------|
| Multiplication | What new capacity, opportunity, or lasting good was created? |
| Subtraction    | What suffering, waste, dependency, or recurring problem was reduced? |
| Stewardship    | Were resources used faithfully and as promised? |
| Sustainability | Can the work continue after the original funding ends? |
| Restoration    | When mistakes or failures occurred, were they acknowledged and corrected? |

## 3. Privacy model (detail in backlog item 8)

- Base tables have RLS on; `anon` has **no** direct select on any base table.
- Public reads go through `public_*` views (`public_projects`,
  `public_ledger`, `public_evidence`, …) that select only non-P columns and
  only rows whose project has `visibility = 'public'`.
- Donor, worker, and beneficiary personal details never appear in any
  `public_*` view. Item 17 adds an automated check for this.
- Authenticated editors are scoped to their own organization's projects
  (item 8c; needs an editor/organization membership table).
- Implemented so far (`20261030000009_public_views_core_ledger.sql`):
  `public_projects`, `public_organizations` (only orgs with a public
  project), `public_project_leaders` (role always; name/title only with
  `public_profile`), `public_assertions`, `public_budget_lines`,
  `public_funds_received` (no donor identity), `public_purchases` (supplier
  name/kind/place only), `public_payments` (no reference number),
  `public_budget_vs_actual`. Views run as owner with `security_barrier`;
  `anon`/`authenticated` get select on the views only.

## 4. Review flags (backlog item 19)

Consistency checks produce **needs review** flags, not verdicts — e.g. spent
> approved, payment with no receipt document, claim with no document after
N days, a verifier later found to have a tie to the project, an exchange
rate far from other rates for the same currency and date range. Any future AI assistance only
adds flags for a human to look at.
