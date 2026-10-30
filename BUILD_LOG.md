# Build Log

## 2026-10-23 — Run 1: scaffold

**Built:** Minimal Next.js 16 (App Router, TypeScript) app with a landing
page; Supabase client helper reading `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (returns null when unset so the app still
builds); `.env.example` with placeholders only; README; BACKLOG (20 small
items toward a usable Passport prototype); this log.

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`,
`next.config.ts`, `.gitignore`, `.env.example`, `lib/supabase/client.ts`,
`app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `README.md`,
`BACKLOG.md`, `BUILD_LOG.md`, `supabase/migrations/.gitkeep`.

**Size:** ~13 small files, ~250 lines (excluding lockfile).

**Checks:** `npm run typecheck` and `npm run build` pass. No linter yet
(backlog item 1).

**Problems:** None. Pinned TypeScript to 5.x (TS 7 is out but Next.js
tooling targets 5.x).

**Questions for Travis:**
- Is the backlog order right? It puts the data model and RLS before any
  UI. If you'd rather see a page sooner, items 9–12 could move ahead using
  the JSON fixture only.
- Do you have a Supabase project for this yet, or should migrations stay
  local-only (Supabase CLI) for now?

**Next:** Backlog item 1 — ESLint + `npm run lint`.

## 2026-10-24 — Run 2: ESLint (backlog item 1)

**Built:** ESLint 9 flat config using `eslint-config-next` (core-web-vitals
+ typescript presets) and an `npm run lint` script (`eslint .`). Next.js 16
no longer ships `next lint`, so the script calls ESLint directly.

**Files:** `eslint.config.mjs` (new), `package.json`, `package-lock.json`,
`BACKLOG.md`, `BUILD_LOG.md`.

**Size:** 1 new ~10-line file, 3 lines in `package.json`, plus lockfile.

**Checks:** `npm run lint` (0 findings), `npm run typecheck`, and
`npm run build` all pass.

**Problems:** None.

**Questions for Travis:** None new (Run 1's questions on backlog order and
Supabase project still stand).

**Next:** Backlog item 2 — `docs/data-model.md` (entities, private fields,
claim/document/verified rule).

## 2026-10-25 — Run 3: Data model doc (backlog item 2)

**Built:** `docs/data-model.md` — the design reference for migrations
001–005 and RLS. Covers the claim / documented / verified rule (status
stored on `assertions` but enforced by trigger; a verification must be by an
independent verifier with `finding = 'confirmed'`; not-confirmed/disputed
findings show as "needs review"), every entity and its fields, which fields
are private (donor identity, contact details, payment reference numbers,
precise GPS, personal-data documents), the `public_*` view approach for
anonymous reads, and Kingdom Return as narrative + linked evidence with no
score column.

**Files:** `docs/data-model.md` (new), `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** 1 new doc, ~170 lines. No code changes.

**Checks:** `npm run lint`, `npm run typecheck`, `npm run build` pass.

**Problems:** None.

**Questions for Travis:**
- "Independent" verifier is defined as not a leader/staff of the
  responsible organization. Is that strict enough, or should a verifier
  also need no financial tie to the project (e.g. not a major donor)?
- Should the passport track a single currency per project (current design)
  or record each transaction's original currency plus an exchange rate?
  (Run 1's questions on backlog order and Supabase project still stand.)

**Next:** Backlog item 3 — Migration 001 (`organizations`, `people`,
`projects`, `project_leaders`).

## 2026-10-25 — Decisions from Travis (data model update)

**Decisions:**
- Independent verifiers must have **nothing to do with the project at
  all**: not org leaders, staff, or board members, donors, suppliers, payees,
  asserters/uploaders, or beneficiaries.
- Money keeps its **original currency plus an exchange rate** to the
  project's base currency.

**Changed:** `docs/data-model.md`. The `verifications` insert trigger now
rejects any verifier linked to the project anywhere in its records. A
required `independence_declaration` covers ties the database can't see, and
a tie found later flags the verification "needs review". Removed the
"affiliated" verification type. Added `donor_person_id` and
`contact_person_id` (private) so the trigger can check donor and supplier
links. Every money row now has `amount, currency, exchange_rate, rate_date,
rate_source, amount_base`. `projects.currency` is now `base_currency`.
Added a review flag for outlier exchange rates.

**Size:** ~40 lines in one doc. No code changes.

**Next:** Backlog item 3 — Migration 001.

## 2026-10-27 — Run 4: Migration 001 (backlog item 3)

**Built:** `supabase/migrations/20261027000001_core.sql`: `organizations`,
`people`, `projects`, `project_leaders`.
- Private columns (org registration/contact/address; people full name,
  email, phone, address, notes) are commented `PRIVATE` for the item 8
  `public_*` views.
- Added `people.is_beneficiary`. A check constraint stops a beneficiary from
  having a public profile, and a trigger stops a beneficiary from being a
  project leader.
- `projects`: enums for status and visibility (default `private`), slug
  format check, ISO-4217 `base_currency`, end date not before start date.
- `leader_role` enum: `local_lead`, `treasurer`, `board`, `staff`, `other`.
- RLS is enabled on all four tables with **no policies yet**, so anon and
  authenticated users can read nothing until item 8.

**Files:** `supabase/migrations/20261027000001_core.sql` (new),
`docs/data-model.md` (people + leader roles), `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~130-line SQL file, ~7 lines of doc changes.

**Checks:** Applied the migration to a throwaway local Postgres 16. It
applied cleanly, and the beneficiary rules and slug check rejected bad rows
as expected. `npm run lint`, `typecheck`, and `build` pass. Nothing was
applied to the real Supabase project.

**Problems:** None.

**Questions for Travis:** None new. Run 1's question about which Supabase
project to use still stands; the migrations haven't been pushed anywhere.

**Next:** Backlog item 4: Migration 002 (`assertions`, `documents`,
`verifications`, with the status and verifier-independence triggers). It
may need splitting: the tables in one run, the triggers in the next.

## 2026-10-28 — Run 5: Migration 002 tables (backlog item 4a)

**Split:** Item 4 was too big for one night, so it's now 4a (tables) and 4b
(triggers). Tonight was 4a.

**Built:** `supabase/migrations/20261028000002_assertions.sql`:
- `assertions`: `status` enum (`claim` / `documented` / `verified`), default
  `claim`, non-blank statement, cascades from `projects`.
- `documents`: `kind` enum, `contains_personal_data` flag (its
  `storage_path` is commented PRIVATE when the flag is set).
- `verifications`: method and finding enums, required non-blank
  `independence_declaration`, the declaration can't be dated after the
  verification, and new `tie_flagged` + `tie_flag_note` columns (a note is
  required when flagged) so a tie found later can mark it "needs review".
- RLS enabled, no policies (same as migration 001).

**Files:** `supabase/migrations/20261028000002_assertions.sql` (new),
`docs/data-model.md` (two field lists updated), `BACKLOG.md` (split + check),
`BUILD_LOG.md`.

**Size:** ~100-line SQL file, ~5 lines of doc changes.

**Checks:** Applied migrations 001 and 002 to a throwaway local Postgres 16.
Both applied cleanly. A blank statement, a blank declaration, and a flag with
no note were each rejected, and a valid verification was accepted. Lint,
typecheck, and build pass (after `npm ci` in a fresh container). Nothing was applied to the real Supabase
project.

**Problems:** None.

**Questions for Travis:** None new. Run 1's Supabase-project question still
stands.

**Next:** Item 4b: the status-sync trigger and the verifier-independence
trigger.

## 2026-10-29 — Run 6: Assertion status + independence triggers (backlog item 4b)

**Built:** `supabase/migrations/20261029000003_assertion_triggers.sql`:
- `compute_assertion_status()` derives the status: `verified` if any
  confirmed, unflagged verification exists; else `documented` if any
  document exists; else `claim`.
- A before-insert/update trigger on `assertions` ignores whatever status is
  written and uses the derived one (new assertions always start as `claim`).
- After-insert/update/delete triggers on `documents` and `verifications`
  re-derive the status, so it drops back when support is removed, a
  verification is flagged, or the finding isn't `confirmed`.
- A before-insert/update trigger on `verifications` rejects a verifier who
  is a beneficiary, a leader of the project, the author of any of the
  project's assertions, or the uploader of any of its documents.

**Files:** `supabase/migrations/20261029000003_assertion_triggers.sql` (new),
`docs/data-model.md` (one note), `BACKLOG.md` (check), `BUILD_LOG.md`.

**Size:** ~130-line SQL file, 2 lines of doc changes.

**Checks:** Applied migrations 001–003 to a throwaway local Postgres 16.
Tested: a hand-set `verified` stays `claim`; adding a document gives
`documented`; leader, uploader, and beneficiary verifiers are each
rejected; a `disputed` verification doesn't raise status; a confirmed
independent one gives `verified`; flagging it drops back to `documented`;
deleting the document drops to `claim`; cascades still work. Lint,
typecheck, and build pass. Nothing applied to the real Supabase project.

**Problems:** None.

**Note:** The independence check runs when a verification is written. If
the verifier is added to the project later (e.g. made a leader), the
existing verification isn't automatically flagged. Item 19 (consistency
flags) is a natural place to surface that as "needs review".

**Questions for Travis:** None new. Run 1's Supabase-project question still
stands.

**Next:** Item 5: Migration 003 (budget lines, funds received, suppliers,
purchases/payments). Likely to need splitting.

## 2026-10-30 — Run 7: Budget lines + funds received (backlog item 5a)

**Built:** Item 5 was too large for one night, so it was split into 5a and 5b.
`supabase/migrations/20261030000004_budget_funds.sql` (item 5a):
- `budget_lines` and `funds_received`, both using the currency rule: original
  amount + currency + exchange rate + rate date + rate source, with a
  generated base-currency amount (`approved_amount_base` / `amount_base`).
- New `rate_source` enum, including `same_currency`. A trigger requires
  rate = 1 and `same_currency` when the row's currency equals the project's
  base currency, and a real source when it doesn't.
- `funds_received.source_category` is public; donor identity columns
  (`donor_person_id`, `donor_name`, `donor_contact`, `donor_reference`) are
  marked PRIVATE.
- A unique `(id, project_id)` on `assertions` plus composite foreign keys, so
  a money row can only link to an assertion in its own project. Deleting the
  assertion clears the link and keeps the money row.
- RLS on, no policies (public views come in item 8). Money is only recorded.

**Files:** `supabase/migrations/20261030000004_budget_funds.sql` (new),
`docs/data-model.md` (currency rule paragraph), `BACKLOG.md` (split 5 into
5a/5b, check 5a), `BUILD_LOG.md`.

**Size:** ~125-line SQL file, ~6 lines of doc changes.

**Checks:** Applied migrations 001–004 to a throwaway local Postgres 16.
Tested: a USD line in a USD project is accepted; a UGX gift converts
correctly (3,700,000 × 0.00027 = 999.00); USD with rate 1.1 is rejected;
UGX marked `same_currency` is rejected; an assertion from another project is
rejected; a zero amount is rejected; deleting a linked assertion sets the
link to null. Lint, typecheck, and build pass. Nothing applied to the real
Supabase project.

**Problems:** None.

**Note:** If a project's `base_currency` is changed after money rows exist,
those rows aren't rechecked. Item 19 (consistency flags) can surface that.

**Questions for Travis:** None new. Run 1's Supabase-project question still
stands.

**Next:** Item 5b: suppliers, purchases, payments, and extending the
independence check to donors and supplier contacts.

## 2026-10-30 — Run 8 (extra session requested by Travis): Suppliers, purchases, payments (backlog item 5b)

**Built:** `supabase/migrations/20261030000005_suppliers_purchases_payments.sql`:
- `suppliers` (shared across projects; contact person/name/phone/email and
  bank details note marked PRIVATE).
- `purchases` linked to a budget line and supplier, and `payments` linked to
  a purchase (`reference_number` PRIVATE). Both use the currency rule and the
  same-currency trigger from 003a.
- Composite foreign keys: a purchase's budget line and a payment's purchase
  must be in the same project; assertions too. `payments` carries
  `project_id` for this (added to the data model doc).
- A budget line with purchases can't be deleted; deleting a purchase removes
  its payments; deleting a project cascades cleanly.
- Verifier independence now also rejects the project's donors
  (`funds_received.donor_person_id`) and contacts of suppliers the project
  bought from.

**Files:** `supabase/migrations/20261030000005_suppliers_purchases_payments.sql`
(new), `docs/data-model.md` (suppliers kind, payments project_id, same-project
note), `BACKLOG.md` (check 5b), `BUILD_LOG.md`.

**Size:** ~180-line SQL file (about 50 of it the re-created independence
function), ~6 lines of doc changes.

**Checks:** Applied migrations 001–005 to a throwaway local Postgres 16.
Tested: UGX purchase and payment convert correctly (1,110,000 × 0.00027 =
299.70); budget line from another project rejected; payment pointing at
another project's purchase rejected; USD payment with rate 2 rejected;
deleting a budget line with purchases rejected; donor and supplier-contact
verifiers rejected; an independent verifier accepted and the assertion
becomes `verified`; deleting a purchase removes its payments; deleting a
project cascades. Lint, typecheck, and build pass. Nothing applied to the
real Supabase project.

**Problems:** None.

**Note:** Like the earlier checks, independence is tested when the
verification is written; a person who becomes a donor or supplier contact
afterwards isn't flagged automatically (item 19).

**Questions for Travis:** None new.

**Next:** Item 6: Migration 004 (evidence items, progress reports, outcomes,
lessons, sustainability plans). Likely to need splitting.

## 2026-10-30 — Run 9 (same extra session): Evidence items + progress reports (backlog item 6a)

**Built:** Item 6 split into 6a/6b.
`supabase/migrations/20261030000006_evidence_reports.sql` (item 6a):
- `evidence_items`: kind, caption, capture date, location label, storage
  path, `shows_identifiable_people`; precise GPS PRIVATE (both or neither).
  Must link to an assertion in the same project; deleted with it.
- `progress_reports`: period (start ≤ end), summary, setbacks, author,
  optional same-project assertion.
- Evidence items do not change an assertion's status; only documents and
  independent verifications do.
- Verifier independence now also rejects progress report authors.

**Files:** `supabase/migrations/20261030000006_evidence_reports.sql` (new),
`docs/data-model.md` (evidence_items paragraph), `BACKLOG.md` (split 6,
check 6a), `BUILD_LOG.md`.

**Size:** ~140-line SQL file (about 55 of it the re-created independence
function), ~6 lines of doc changes.

**Checks:** Applied migrations 001–006 to a throwaway local Postgres 16.
Tested: evidence leaves status at `claim`; another project's assertion is
rejected; half a GPS pair is rejected; reversed report period is rejected;
a report author as verifier is rejected; an independent verifier is
accepted; deleting the assertion removes its evidence. Lint, typecheck, and
build pass. Nothing applied to the real Supabase project.

**Questions for Travis:** Should a piece of evidence (e.g. a site photo)
count like a document and move a claim to "documented"? For now it doesn't:
only items in `documents` do. If yes, it's a small trigger change.

**Next:** Item 6b: outcomes, lessons, sustainability plans.

## 2026-10-30 — Run 10 (same extra session): Outcomes, lessons, sustainability (backlog item 6b)

**Built:** `supabase/migrations/20261030000007_outcomes_lessons_sustainability.sql`:
`outcomes` (description, measure, free-text target/achieved, optional
same-project assertion), `lessons` (text, date), `sustainability_plans`
(plan, funding after grant, local owner, review date). RLS on, no policies.
No personal-data columns.

**Files:** the new migration, `docs/data-model.md` (one note on outcomes),
`BACKLOG.md` (check 6b), `BUILD_LOG.md`.

**Size:** ~70-line SQL file, 2 lines of doc changes.

**Checks:** Applied migrations 001–007 to a throwaway local Postgres 16.
Tested: valid rows accepted; an assertion from another project rejected; a
blank lesson rejected; deleting the assertion clears the outcome's link;
deleting the project removes all three. Lint, typecheck, and build pass.

**Questions for Travis:** None new (see Run 9's evidence question).

**Next:** Item 7: Migration 005 (Kingdom Return entries, no score).

## 2026-10-30 — Run 11 (same extra session): Kingdom Return entries (backlog item 7)

**Built:** `supabase/migrations/20261030000008_kingdom_return.sql`:
- `kingdom_return_entries`: dimension enum (multiplication, subtraction,
  stewardship, sustainability, restoration), required narrative, date,
  author. **No score, rating, or numeric column**, by design.
- `kingdom_return_links`: each row links an entry to exactly one assertion
  or one evidence item from the same project; no duplicate links. Links are
  removed when their entry, assertion, or evidence item is deleted.
- Verifier independence now also rejects Kingdom Return authors. That
  completes the list in `docs/data-model.md` §1.

**Files:** the new migration, `docs/data-model.md` (links paragraph),
`BACKLOG.md` (check 7), `BUILD_LOG.md`.

**Size:** ~150-line SQL file (about 60 of it the re-created independence
function), 3 lines of doc changes.

**Checks:** Applied migrations 001–008 to a throwaway local Postgres 16.
Tested: valid entry + assertion link + evidence link accepted; unknown
dimension rejected; a link with both or neither target rejected; duplicate
link rejected; a link to another project's assertion rejected; KR author as
verifier rejected, independent verifier accepted; confirmed no numeric
columns exist on the KR tables; deleting evidence removes its link only.
Lint, typecheck, and build pass. Nothing applied to the real Supabase
project.

**Questions for Travis:** None new.

**Next:** Item 8: Row Level Security and the `public_*` views. This is the
privacy-critical step; it will likely be split (e.g. 8a views for project /
organization / leaders / ledger, 8b evidence / reports / KR + a check that no
PRIVATE column leaks).

## 2026-10-30 — Run 12 (same extra session): Public views, core + ledger (backlog item 8a)

**Built:** Item 8 split into 8a/8b/8c.
`supabase/migrations/20261030000009_public_views_core_ledger.sql`:
nine `public_*` views (projects, organizations, project leaders, assertions,
budget lines, funds received, purchases, payments, budget-vs-actual). Each
selects only non-private columns and only rows from projects with
`visibility = 'public'`. They run as the view owner with `security_barrier`,
and `anon`/`authenticated` are granted select on the views only. Base tables
keep RLS on with no policies.

**Files:** the new migration, `docs/data-model.md` (§3 privacy model),
`BACKLOG.md` (split 8, check 8a), `BUILD_LOG.md`.

**Size:** ~150-line SQL file, ~12 lines of doc changes.

**Checks:** On a throwaway local Postgres 16 with Supabase-like `anon` and
`authenticated` roles (default select grants on all tables, like Supabase):
anon sees 0 rows in base `projects`, `people`, `funds_received`; the views
show only the public project and its org; the leader without a public
profile shows role but no name; budget-vs-actual gives 1000 / 250 / 750;
no donor name or id, supplier phone, payment reference, or org email
appears in any view row. Lint, typecheck, and build pass. Nothing applied
to the real Supabase project.

**Questions for Travis:** For 8c, who edits a project record in the pilot,
just you and John, or people from the ministry too? That decides whether
`organization_members` needs roles (e.g. editor vs. viewer) now.

**Next:** Item 8b: remaining public views + an automated leak check.

## 2026-10-30 — Run 13 (same extra session): Public views, proof + results; leak check (backlog item 8b)

**Built:** `supabase/migrations/20261030000010_public_views_proof_results.sql`:
nine more `public_*` views (documents, verifications, evidence, progress
reports, outcomes, lessons, sustainability plans, Kingdom Return entries and
links), same pattern as 8a. Document storage paths are hidden when marked
personal; verification notes are never shown; evidence never shows GPS and
items showing identifiable people are left out (and so are KR links to
them); people's names appear only with a public profile.
`supabase/checks/public_views_no_private_columns.sql`: fails if any
`public_*` view reads a column commented `PRIVATE`.

**Files:** the new migration, `supabase/checks/public_views_no_private_columns.sql`
(new), `docs/data-model.md` (§3), `BACKLOG.md` (check 8b), `BUILD_LOG.md`.

**Size:** ~110-line SQL migration, ~35-line check script, ~12 lines of docs.

**Checks:** On a throwaway local Postgres 16 with Supabase-like roles: the
leak check passes on the real views and correctly fails on a deliberately
leaky test view (then dropped). As anon: personal-data document shows title
but no path; private-profile verifier shows no name; the photo flagged as
showing people is hidden, and so is its KR link; the private project's
document is hidden; no secret marker strings or GPS values appear; base
`documents` returns 0 rows. Lint, typecheck, and build pass.

**Note:** Document titles are public. Editors should avoid putting personal
names in titles (e.g. "Worker contract", not "Contract – <name>"). Item 19
could flag titles that look like names.

**Questions for Travis:** Run 12's question (who edits in the pilot) blocks
item 8c.

**Next:** Item 8c (editor access), once Travis answers; otherwise item 9
(shared TypeScript types + status badge) can go first.

## 2026-10-30 — Run 14 (same extra session): Shared types + status badge (backlog item 9)

**Backlog change:** Moved 8c (editor access) to after item 11 as **11b**,
since it waits on Travis's answer about who edits in the pilot and nothing
before item 12 depends on it. Item 9 went next.

**Built:**
- `lib/types.ts`: enums for every database enum, the five Kingdom Return
  dimensions with their guiding questions (no score), a `RecordedAmount`
  shape for the currency rule, and one interface per `public_*` view. These
  types contain no private fields, so pages built on them can't render one.
- `app/components/StatusBadge.tsx`: `StatusBadge` (Claim ○ dashed /
  Documented ◐ blue / Verified ● green, distinct by icon, label, border and
  color) and `NeedsReviewBadge` (⚑, for tie-flagged verifications; a prompt
  for review, not a verdict).
- Badge styles in `app/globals.css` (light + dark), and a status legend on
  the home page.

**Files:** `lib/types.ts` (new), `app/components/StatusBadge.tsx` (new),
`app/globals.css`, `app/page.tsx`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~250 lines of TS (mostly type declarations), ~30 lines CSS.

**Checks:** Lint, typecheck, and build pass. Screenshot of the home page at
phone width shows the three badges distinct. The ◐ glyph renders small in
the default font; worth swapping for a clearer shape when the record page
is styled (item 12).

**Questions for Travis:** Still open: who edits in the pilot (blocks 11b);
should evidence count toward "documented" (Run 9).

**Next:** Item 10: seed data for one fictional sample project.
