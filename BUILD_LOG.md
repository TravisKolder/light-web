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

## 2026-10-30 — Decisions from Travis + Run 15: Evidence counts as a document

**Decisions (Travis, 2026-10-30):**
1. Evidence counts like a document: an evidence item moves a claim to
   "documented" (never to "verified").
2. Editor access starts with just Travis and John; widen to ministry staff
   later. Backlog item 11b reworded to a simple `editors` table.

**Built:** `supabase/migrations/20261030000011_evidence_counts_as_document.sql`:
- `compute_assertion_status()` now counts evidence items as well as
  documents for `documented`.
- A trigger on `evidence_items` re-derives status on insert, update, or
  delete, so it drops back when evidence is removed.
- New `evidence_items.uploaded_by` (not in any public view), and the
  independence check rejects whoever supplied evidence for the project.

**Files:** the new migration, `docs/data-model.md` (§1 rule, evidence
paragraph, §3 editors), `BACKLOG.md` (11b reworded), `BUILD_LOG.md`.

**Size:** ~120-line SQL file (most of it the re-created independence
function), ~10 lines of doc changes.

**Checks:** Applied migrations 001–011 to a throwaway local Postgres 16.
Tested: claim → documented after adding evidence; the evidence uploader is
rejected as verifier; an independent verifier gives verified; removing the
verification drops to documented; removing the evidence drops to claim.
The private-column leak check still passes. Lint, typecheck, and build pass.

**Note:** An evidence item that shows identifiable people is hidden from the
public view but still counts toward "documented", just like a document
marked as containing personal data. The public page should say "supported
by material not shown publicly" in that case (item 17).

**Questions for Travis:** None open.

**Next:** Item 10: seed data for one fictional sample project.

## 2026-10-30 — Run 16 (20-minute session requested by Travis): Sample project seed data (backlog item 10)

**Built:** `supabase/seed.sql`: one entirely fictional project, "SAMPLE:
Kibira Village Primary School classroom block", run by the fictional
"Hillside Hope Fellowship". All names, places, and contacts are invented;
phones use 555 numbers and e-mails use `.example`. It has two leaders (one
with a public profile), a 3-line USD budget, a USD gift and a UGX gift with
an exchange rate, two suppliers, three purchases, four payments, four
documents (two marked as containing personal data), two evidence photos
(one showing children, so private), one independent site-visit
verification, a progress report that records a setback openly, two
outcomes, two lessons, a sustainability plan, and Kingdom Return entries for
all five dimensions with links. Fixed UUIDs (`00000000-5a3e-…`). README
gains a short "Database" section.

**Files:** `supabase/seed.sql` (new), `README.md`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~330-line SQL seed, ~8 lines README.

**Checks:** Migrations + seed load cleanly on a throwaway Postgres 16.
Statuses derived by the triggers come out as intended: one verified (roof),
five documented, one claim (parents' committee). Budget vs. actual:
Materials 6000 / 2099.70 / 3900.30, Labour 3000 / 2800 / 200, Furniture
1000 / 0 / 1000; funds received 5999.00 USD. As anon, the private photo,
treasurer's name, donor identity, supplier contacts, payment references, and
personal-data document paths don't appear in any public view. Lint,
typecheck, build pass.

**Next:** Item 11: JSON fixture of the same sample for when Supabase isn't
configured.

## 2026-10-30 — Run 17 (same session): Local sample fallback (backlog item 11)

**Built:**
- `scripts/export-sample-fixture.sql`: exports the sample project as JSON by
  reading only the `public_*` views **as the anon role**, so private data
  can't end up in the fixture.
- `lib/sample/passport.json`: the generated fixture (fictional, public
  fields only).
- `lib/passport.ts`: a `Passport` type and `getPassport(slug)`. With Supabase
  configured it reads the public views; without it, it returns the sample
  for slug `sample-kibira-classroom-block` and null for anything else.
- `scripts/check-sample-fixture.mjs` + `npm run check:fixture`: fails if the
  fixture contains any private-looking field (GPS, donor, contact, reference
  number, author/uploader ids, etc.).
- README: how to regenerate and check the fixture.

**Files:** `lib/passport.ts`, `lib/sample/passport.json`,
`scripts/export-sample-fixture.sql`, `scripts/check-sample-fixture.mjs` (all
new), `package.json` (script), `README.md`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~100 lines TS, ~35 lines SQL, ~35 lines JS, ~530-line generated
JSON.

**Checks:** Fixture generated from the seeded local database; the check
passes on it and fails when a `gps_lat` field is added by hand (then
reverted). Lint, typecheck, build pass. The Supabase path isn't exercised
yet (no project configured); item 12 will use `getPassport`.

**Next:** Item 11b (editor access for Travis and John) is next in order. It
needs Supabase Auth user ids for Travis and John when it's applied, but the
migration can be written without them.

## 2026-10-30 — Run 18 (same session): Editor access, pilot version (backlog item 11b)

**Built:** `supabase/migrations/20261030000012_editors.sql`:
- `public.editors` (Supabase Auth user id → display name), RLS on; editors
  can read it, nobody can add themselves through the API.
- `public.is_editor()` (security definer, empty search_path).
- An `editors_all` policy on all 19 base tables: editors get full
  read/write; everyone else still sees only the `public_*` views.
- README: how to add Travis and John once they've signed up.

**Files:** the new migration, `docs/data-model.md` (§3), `README.md`,
`BACKLOG.md` (check 11b), `BUILD_LOG.md`.

**Size:** ~65-line SQL file, ~20 lines of docs.

**Checks:** On a throwaway Postgres 16 with a stubbed `auth` schema and
Supabase-style grants, after migrations + seed: anon sees 0 people and
can't write; a signed-in non-editor sees 0 people, 0 editors, can't write,
can't add themselves as editor, but can read the public view; an editor
sees all 6 people and can write; an editor trying to force an assertion to
`verified` still gets the derived `claim`; an editor can't add another
editor through the API. Leak check still passes. Lint, typecheck, build
pass. Nothing applied to the real Supabase project.

**Questions for Travis:** None. When the Supabase project is set up, you and
John sign up, then run the insert from the README.

**Next:** Item 12: project record page `/projects/[slug]`.

## 2026-10-30 — Run 19 (same session): Project record page (backlog item 12)

**Built:** `app/projects/[slug]/page.tsx`, a server-rendered page using
`getPassport()`: breadcrumb, a "sample data — entirely fictional" banner when
served from the fixture, title, status / location / dates / reporting
currency, responsible organization, local leaders (role always; name only
with a public profile, otherwise "Name not shown publicly"), need, and
objectives. Unknown slugs return 404. Home page links to the sample. Page
styles added to `app/globals.css`.

**Files:** `app/projects/[slug]/page.tsx` (new), `app/page.tsx`,
`app/globals.css`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~130 lines TSX, ~20 lines CSS.

**Checks:** Lint, typecheck, build pass. Ran the production build locally:
the sample page renders in light (phone width) and dark (desktop)
screenshots; `/projects/nope` returns 404; the page HTML contains no
private sample names, phone numbers, or `.example` e-mails.

**Next:** Item 13: budget-vs-actual ledger section.

## 2026-10-30 — Run 20 (same session): Budget-vs-actual ledger (backlog item 13)

**Built:** `app/projects/[slug]/Ledger.tsx`, added below the record:
- Budget lines: approved / spent / remaining in the reporting currency, with
  totals, an "Over budget" marker when remaining goes negative, and each
  line's Claim / Documented / Verified badge.
- Funds received: date, source category only (no giver identity), base
  amount, and for foreign-currency gifts the original amount, rate, rate
  source and date; total received.
- Summary: received, spent, recorded balance.
- Purchases: date, quantity + description, supplier name and budget line,
  cost (with original currency when different), amount paid, status badge.
- `lib/format.ts`: shared money/date formatting (moved `formatDate` out of
  the page).

**Files:** `app/projects/[slug]/Ledger.tsx`, `lib/format.ts` (new),
`app/projects/[slug]/page.tsx`, `app/globals.css`, `BACKLOG.md`,
`BUILD_LOG.md`.

**Size:** ~170 lines TSX, ~25 lines TS, ~20 lines CSS.

**Checks:** Lint, typecheck, build pass. Screenshots at desktop and phone
width: figures match the seed (10,000 / 4,899.70 / 5,100.30; received
5,999.00; balance 1,099.30). On phones the tables scroll sideways inside
their own box; the page itself doesn't. No private sample data (giver
names, payment references, contact details) in the page HTML.

**Note:** The labour purchase has no assertion in the seed, so it shows "No
assertion". That's a good candidate for item 19's "needs review" flags
(payment without receipt).

**Next:** Item 14: evidence list section.

## 2026-10-30 — Run 21 (same session): Evidence list (backlog item 14)

**Built:** `app/projects/[slug]/Evidence.tsx`, a "Claims, evidence, and
verification" section listing every assertion with its status badge and
date, then:
- **Supporting material**: public documents (kind, title, date; "file not
  public (contains personal data)" where marked) and public evidence
  (caption, date, location label).
- When an assertion is documented or verified but none of its support is
  public (e.g. a photo of children), it says "Supported by material not
  shown publicly, to protect people's privacy."
- **Independent verification**: finding, verifier (name only with a public
  profile), method, date, independence-declaration date, and a "Needs
  review" badge when tie-flagged.
- Claims with nothing attached say so plainly.

**Files:** `app/projects/[slug]/Evidence.tsx` (new),
`app/projects/[slug]/page.tsx`, `app/globals.css`, `BACKLOG.md`,
`BUILD_LOG.md`.

**Size:** ~120 lines TSX, ~10 lines CSS.

**Checks:** Lint, typecheck, build pass. Screenshot matches the seed: one
verified (roof, with the roof photo and Ruth N.'s site visit), five
documented (two with private files, one with only private support), one
claim. No private file paths, references, or contact details in the HTML.

**Next:** Item 15: progress reports, outcomes, lessons, sustainability
sections.

## 2026-10-30 — Run 22 (same session): Progress, outcomes, lessons, sustainability (backlog item 15)

**Built:** `app/projects/[slug]/Results.tsx`, four sections below the
evidence list:
- **Progress reports**: period, summary, setbacks shown openly, author name
  only with a public profile, and the linked claim's status badge (labelled
  "linked claim" so the badge isn't read as verifying the whole report).
- **Outcomes**: description, target, achieved, status badge.
- **Lessons learned**: lesson and date.
- **Sustainability**: plan, local owner, funding after the grant, next
  review date.
Each shows a plain "not recorded yet" line when empty.

Also changed the sample outcome text "120 pupils (claimed)" to "120 pupils"
in `supabase/seed.sql` and the fixture, since the badge already shows its
status.

**Files:** `app/projects/[slug]/Results.tsx` (new),
`app/projects/[slug]/page.tsx`, `app/globals.css`, `supabase/seed.sql`,
`lib/sample/passport.json`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~110 lines TSX, ~8 lines CSS.

**Checks:** Lint, typecheck, build, fixture check pass; screenshot reviewed.

**Next:** Item 16: Kingdom Return section.

## 2026-10-30 — Run 23 (same session): Kingdom Return section (backlog item 16)

**Built:** `app/projects/[slug]/KingdomReturn.tsx`: all five dimensions in
order (Multiplication, Subtraction, Stewardship, Sustainability,
Restoration), each with its guiding question, the narrative entries (date,
author only with a public profile), and the linked claims (with status
badges) or evidence captions. Empty dimensions say "Nothing recorded yet";
unlinked entries say "Not yet linked to any evidence". No score, rating,
meter, or progress bar anywhere, and the intro says so.

**Files:** `app/projects/[slug]/KingdomReturn.tsx` (new),
`app/projects/[slug]/page.tsx`, `app/globals.css`, `BACKLOG.md`,
`BUILD_LOG.md`.

**Size:** ~80 lines TSX, ~6 lines CSS.

**Checks:** Lint, typecheck, build pass. Dark-mode screenshot reviewed; the
private photo of pupils is not shown anywhere on the page.

**Next:** Item 17: public read-only view `/p/[slug]` and an automated check
that private fields never appear in its output. (The `/projects/[slug]` page
already reads only public data; item 17 decides how the two routes differ,
likely `/projects` becomes the editor view once editing exists.)

## 2026-10-30 — Run 24 (same session): Public read-only view + leak check (backlog item 17)

**Built:**
- Moved the page body into `app/components/passport/PassportView.tsx` (with
  `Ledger`, `Evidence`, `Results`, `KingdomReturn` alongside), so two routes
  share it.
- `app/p/[slug]/page.tsx`: the public read-only Passport, marked "public
  read-only view". `/projects/[slug]` stays as a thin page over the same view
  and is where editing will go later. Home page now links to `/p/…`.
- `scripts/check-public-page.mjs` + `npm run check:public-page`: starts the
  production build, fetches the public sample page, and fails if any of 29
  private sample values (full names, private role titles, e-mail domains,
  phone numbers, donor/payment/registration references, private file paths,
  the private photo caption, verification notes and declaration text)
  appears in the HTML.

**Files:** `app/components/passport/*` (moved from `app/projects/[slug]/`),
`app/projects/[slug]/page.tsx` (rewritten thin), `app/p/[slug]/page.tsx`
(new), `scripts/check-public-page.mjs` (new), `package.json`, `app/page.tsx`,
`README.md`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~60 lines of new pages, ~70-line check script; the rest is moves.

**Checks:** Lint, typecheck, build pass. The page check passes on the real
build and **fails** when the treasurer's private name is planted in the
fixture (then reverted and re-checked clean).

**Next:** Item 18: projects index page.

## 2026-10-30 — Run 25 (same session): Projects index (backlog item 18)

**Built:** `app/p/page.tsx`, the public projects list: each public project's
title (linking to `/p/<slug>`), organization, region, project status, and
how many of its claims are Verified / Documented / Claim (badges with
counts: context, not a rating). Sample banner when serving the fixture.
`listProjects()` added to `lib/passport.ts` (public views, or the sample
when Supabase isn't configured). Home page links to `/p`.

**Files:** `app/p/page.tsx` (new), `lib/passport.ts`, `app/page.tsx`,
`app/globals.css`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~55 lines TSX, ~45 lines TS, ~6 lines CSS.

**Checks:** Lint, typecheck, build, public-page leak check pass. Phone-width
screenshot shows the sample with 1 verified / 5 documented / 1 claim.

**Next:** Item 19: simple consistency flags ("needs review", never
verdicts). Then item 20, the pilot readiness pass.

## 2026-10-30 — Run 26 (same session): Consistency flags (backlog item 19)

**Built:**
- `lib/flags.ts`: `computeFlags(passport)`, rule-based (no AI), from public
  data only. Flags: spending over a budget line's approved amount; total
  payments over funds received; a purchase paid more than its cost;
  payments with no receipt or other supporting document; claims with no
  support for over 60 days; verifications that were tie-flagged or did not
  confirm. Every message is neutral ("someone should take a look").
- `app/components/passport/ReviewFlags.tsx`: a "Needs review" section near
  the top of the Passport, stating that a flag is not a finding of
  wrongdoing.

**Files:** `lib/flags.ts`, `app/components/passport/ReviewFlags.tsx` (new),
`app/components/passport/PassportView.tsx`, `app/globals.css`,
`BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~110 lines TS, ~30 lines TSX.

**Checks:** Lint, typecheck, build, public-page leak check pass. On the
sample, exactly one flag shows (labour payments with no receipt), as
expected. A scratch test on a modified copy of the sample fired all seven
rules.

**Not yet covered** (from `docs/data-model.md` §4): an exchange rate far from
others for the same currency and dates; a verifier who *later* gains a role
in the project (needs a database check, not just the public data); a
project's base currency changed after money rows exist; document titles that
look like personal names. Good candidates for after the pilot review.

**Next:** Item 20: pilot readiness pass (README walkthrough, screenshots,
open questions for Travis and John).

## 2026-10-30 — Run 27 (same session): Pilot readiness pass (backlog item 20)

**Built:** `docs/pilot-readiness.md`: what each page shows, how trust and
privacy are protected, steps to run the pilot on a real project, and seven
open questions for Travis and John. Three screenshots in
`docs/screenshots/` (projects list; full Passport on desktop; full Passport
at phone width in dark mode). README links to it.

**Files:** `docs/pilot-readiness.md`, `docs/screenshots/*.png` (new),
`README.md`, `BACKLOG.md`, `BUILD_LOG.md`.

**Size:** ~100 lines of docs, 3 screenshots (~1.7 MB total).

**Checks:** Lint, typecheck, build pass.

## Backlog complete — proposed next three items (for Travis to approve)

All items 0–20 are checked off. Proposed next, in order:
1. **Simple editor forms** (signed-in editors only) to add assertions,
   documents/evidence metadata, and ledger rows, so the pilot doesn't
   depend on the Supabase table editor.
2. **File uploads to Supabase Storage** with private/public buckets that
   follow `contains_personal_data` and `shows_identifiable_people`.
3. **Database-side review flags** for what the public data can't see: a
   verifier who later gains a role in the project, rates far from others
   for the same currency, base currency changed after money rows exist.

See the open questions in `docs/pilot-readiness.md`; the answers may change
this order.

## 2026-10-31 — Run 28: Backlog complete, awaiting approval

**Built:** Nothing. All backlog items (0–20) are checked off, so per the
nightly rules no new scope was started. The three proposed next items above
(editor forms; Supabase Storage uploads with private/public buckets; database-
side review flags) are still waiting for Travis's approval, along with the
open questions in `docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note.

**Question for Travis:** Approve (or reorder) the three proposed items by
adding them to `BACKLOG.md` as unchecked items; the next run will pick up
the first one.

## 2026-11-01 — Run 29: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items and no new items
have been added since run 28, so per the nightly rules no new scope was
started. The three proposed items (editor forms; Supabase Storage uploads
with private/public buckets; database-side review flags) and the open
questions in `docs/pilot-readiness.md` are still waiting on Travis.

**Files:** `BUILD_LOG.md` only. **Size:** this note.

**Question for Travis:** Add the approved items to `BACKLOG.md` as
unchecked entries (e.g. 21, 22, 23); the next run picks up the first one.

## 2026-11-03 — Run 30: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` still has no unchecked items, so no new
scope was started. The three proposed items (editor forms; Supabase Storage
uploads with private/public buckets; database-side review flags) and the
open questions in `docs/pilot-readiness.md` are still waiting on Travis.

**Files:** `BUILD_LOG.md` only. **Size:** this note.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (e.g. 21, 22, 23); the next run picks up the first one. Consider
pausing the nightly task until then.

## 2026-11-04 — Run 31: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (fourth run in a
row), so no new scope was started. The three proposed items (editor forms;
Supabase Storage uploads with private/public buckets; database-side review
flags) and the open questions in `docs/pilot-readiness.md` are still waiting
on Travis.

**Files:** `BUILD_LOG.md` only. **Size:** this note.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (e.g. 21, 22, 23), or pause the nightly task until you do; each idle
run only adds a note like this one.

## 2026-11-05 — Run 32: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (fifth idle run in a
row), so no new scope was started. Proposed next items remain: editor forms;
Supabase Storage uploads with private/public buckets; database-side review
flags. Open questions are in `docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note. Tracker dashboard not
re-uploaded: its rows are unchanged since run 28.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (21, 22, 23), or pause the nightly task until you do.

## 2026-11-06 — Run 33: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (sixth idle run in a
row). Proposed next items remain: editor forms; Supabase Storage uploads with
private/public buckets; database-side review flags. Open questions are in
`docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note. Tracker dashboard not
re-uploaded: rows unchanged since run 28.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (21, 22, 23), or pause the nightly task until you do.

## 2026-11-07 — Run 34: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (seventh idle run in
a row). Proposed next items remain: editor forms; Supabase Storage uploads
with private/public buckets; database-side review flags. Open questions are
in `docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note. Tracker dashboard not
re-uploaded: rows unchanged since run 28.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (21, 22, 23), or pause the nightly task until you do.

## 2026-11-08 — Run 35: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (eighth idle run in
a row). Proposed next items remain: editor forms; Supabase Storage uploads
with private/public buckets; database-side review flags. Open questions are
in `docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note. Tracker dashboard not
re-uploaded: rows unchanged since run 28.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (21, 22, 23), or pause the nightly task until you do.

## 2026-11-10 — Run 36: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (ninth idle run in a
row). Proposed next items remain: editor forms; Supabase Storage uploads with
private/public buckets; database-side review flags. Open questions are in
`docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note. Tracker dashboard not
re-uploaded: rows unchanged since run 28.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (21, 22, 23), or pause the nightly task until you do.

## 2026-11-11 — Run 37: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (tenth idle run in a
row). Proposed next items remain: editor forms; Supabase Storage uploads with
private/public buckets; database-side review flags. Open questions are in
`docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note. Tracker dashboard not
re-uploaded: rows unchanged since run 28.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (21, 22, 23), or pause the nightly task until you do.

## 2026-11-12 — Run 38: Backlog still complete, awaiting approval

**Built:** Nothing. `BACKLOG.md` has no unchecked items (eleventh idle run in
a row). Proposed next items remain: editor forms; Supabase Storage uploads
with private/public buckets; database-side review flags. Open questions are
in `docs/pilot-readiness.md`.

**Files:** `BUILD_LOG.md` only. **Size:** this note. Tracker dashboard not
re-uploaded: rows unchanged since run 28.

**Question for Travis:** Add approved items to `BACKLOG.md` as unchecked
entries (21, 22, 23), or pause the nightly task until you do.

## 2026-11-12 — Run 39 (on request): Item 21a, editor sign-in

**Built:** Editor sign-in and the `/edit` area. Editors request an emailed
one-time link at `/edit/sign-in` (Supabase Auth, no password); `/auth/callback`
exchanges the code for a session cookie; `proxy.ts` refreshes the session on
`/edit` and `/auth` only. `/edit` shows one of four states: Supabase not
configured (fallback mode, editing off), signed out (redirect to sign-in),
signed in but not on `public.editors` (shows the user id to send to Travis),
or editor (lists all projects with status and private/public visibility, plus
sign out). The editor check reads `public.editors` under RLS, so the page and
the database apply the same rule. No statuses can be set; nothing public changed.

**Files:** `lib/supabase/server.ts`, `proxy.ts`, `app/auth/callback/route.ts`,
`app/edit/actions.ts`, `app/edit/page.tsx`, `app/edit/sign-in/page.tsx`,
`app/globals.css`, `README.md`, `package.json` / `package-lock.json`
(added `@supabase/ssr`), `BACKLOG.md`. **Size:** about 300 lines.

**Checks:** typecheck, lint, build pass; `check:public-page` passes; smoke test
in fallback mode (`/edit` shows the not-configured note, sign-in redirects,
bad callback code returns to sign-in with an error). Not tested against a live
Supabase project, since none is configured here.

**Questions for Travis:** (1) In Supabase, add the `/auth/callback` redirect
URLs listed in the README, or the email links won't work. (2) Any email can
request a link and create an auth user, but that user gets no access until
added to `editors`. If you'd rather block that, turn off "Allow new users to
sign up" in Supabase and invite you and John from the dashboard instead.

**Next:** 21b, statements on `/edit/[slug]`.

## 2026-11-12 — Setup prep (on request)

**Built:** Migration 013 (explicit API grants: anon gets no base-table access;
authenticated gets table privileges, still limited to editors by RLS). Tested
all 13 migrations + seed on a local Postgres 16 with stub Supabase roles:
anon reads public views only, a signed-in non-editor sees 0 projects, an editor
sees the sample project, nobody can write `editors` via the API, and the
private-column check passes. Added `docs/setup.md` (step-by-step Supabase +
Vercel test setup) and `scripts/build-setup-sql.sh` (one-file SQL for the
Supabase SQL Editor).

**Status:** Travis postponed the setup to another night and asked to be
reminded. A "Waiting on Travis" note is at the top of the editor-forms section
in `BACKLOG.md`.

**Next:** 21b, statements on `/edit/[slug]`.

## 2026-11-13 — Run 40: Item 21b, statements editor

**Built:** `/edit/[slug]` for signed-in editors. It lists the project's
statements (assertions), newest first, each with its Claim / Documented /
Verified badge, who made it and when. A form adds a new statement (text,
"asserted by" from a dropdown of non-beneficiary people or "not recorded",
date stated, defaulting to today). The server action re-checks editor access,
validates input (non-empty, 2,000 characters max, real date, not in the future,
person id shape) and inserts without any status field, so every new statement
starts as a claim and only the database triggers can move it. The `/edit`
project list now links to each project's page. Errors show in plain language;
database error text goes to the server log, not the page.

**Files:** `app/edit/[slug]/page.tsx` (new), `app/edit/[slug]/actions.ts`
(new), `app/edit/page.tsx`, `app/globals.css`, `BACKLOG.md`. **Size:** about
200 lines.

**Checks:** typecheck, lint, build pass; `check:public-page` passes; in
fallback mode `/edit/[slug]` redirects to `/edit` (editing off). Not tested
against a live Supabase project (none configured yet).

**Reminder for Travis:** the test Supabase project + Vercel preview
(`docs/setup.md`) is still waiting on you; the editor forms can't be tried
for real until it exists.

**Next:** 21c, document and evidence metadata form.

## 2026-11-14 — Run 41: Item 21c1, document metadata form

**Split:** 21c (documents + evidence) was two forms with different privacy
rules, so it became 21c1 (documents, tonight) and 21c2 (evidence, next).

**Built:** A "Attach a supporting document" form on `/edit/[slug]`. Editors
pick one of the project's statements, a kind (receipt, invoice, photo, report,
contract, bank statement, other), a title, an optional date issued, who
supplied it, and whether it contains personal data. The server action
re-checks editor access, validates every field, and confirms the statement
belongs to this project (documents have no project column of their own) before
inserting. It never sets a status or a file location; the existing trigger
moves the statement from claim to documented. The statement list now shows a
document count per statement. The form warns that a document's supplier can't
later verify the project, and that kind/title/date are always public, so
personal details stay out of titles.

**Files:** `app/edit/[slug]/actions.ts`, `app/edit/[slug]/page.tsx`,
`app/globals.css`, `BACKLOG.md`. **Size:** about 180 lines.

**Checks:** typecheck, lint, build pass; `check:public-page` passes. Not
tested against a live Supabase project (none configured yet).

**Reminder for Travis:** the test Supabase project + Vercel preview
(`docs/setup.md`) is still waiting on you; the editor forms can't be tried
for real until it exists.

**Next:** 21c2, evidence metadata form.

## 2026-11-15 — Run 42: Item 21c2, evidence metadata form

**Built:** A "Record evidence of delivery" form on `/edit/[slug]`. Editors pick
one of the project's statements, a kind (photo, video, receipt, site report,
other), a caption, an optional date captured, an optional public place name,
who supplied it, an optional private GPS pair, and whether it shows people who
could be identified. The server action re-checks editor access, validates every
field (GPS both-or-neither, in range, up to 6 decimals, mirroring the table's
constraints) and confirms the statement belongs to this project before
inserting. It never sets a status or file location; the existing trigger counts
evidence as a supporting document, so a claim can move to documented, never to
verified. The form explains that GPS is never public, that items showing
identifiable people are kept off public pages, and that captions/place names of
other items are public. The statement list now also shows an evidence count.

**Files:** `app/edit/[slug]/actions.ts`, `app/edit/[slug]/page.tsx`,
`app/globals.css`, `BACKLOG.md`. **Size:** about 200 lines.

**Checks:** typecheck, lint, build pass; `check:public-page` passes. Not
tested against a live Supabase project (none configured yet).

**Reminder for Travis:** the test Supabase project + Vercel preview
(`docs/setup.md`) is still waiting on you; the editor forms can't be tried
for real until it exists.

**Next:** 21d, ledger forms part 1 (budget lines and funds received).

## 2026-11-16 — Setup complete (on request)

Travis set up the test Supabase project (`Light-web-test`) and the Vercel
preview at https://light-web-theta.vercel.app, following `docs/setup.md`:
loaded the database, set the sign-in redirect URLs, signed in, and added
himself as an editor. Marked done in `docs/setup.md`; the "Waiting on Travis"
reminder is removed from `BACKLOG.md`, so nightly summaries no longer need to
mention it. Uses fictional sample data only.

**Next:** 21d, ledger forms part 1 (budget lines and funds received).

## 2026-11-17 — Session 43 (on request): Site review, item 22a security quick wins

**Context:** Travis shared an external review of the live site (security +
visual design). He asked for one session now on the most important holes,
with the rest queued for nightly runs ahead of the remaining editor forms.
The review's items became backlog section "Site review fixes" (22a–24).

**Built (22a):**
- Security headers on every route. `proxy.ts` now runs on all pages and sets a
  Content-Security-Policy with a per-request nonce (`script-src 'self'
  'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `form-action
  'self'`, `object-src 'none'`, `connect-src 'self'` since the browser never
  talks to Supabase). Supabase session refresh still only runs on `/edit` and
  `/auth`. `next.config.ts` adds `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`, turns off `x-powered-by` and
  browser source maps. The root layout calls `connection()` so every page is
  rendered per request and gets the nonce (a prerendered page's scripts were
  blocked in testing).
- CSP enforced rather than report-only: tested with a production build in a
  headless browser on `/`, `/p`, both passport pages, `/edit` and a 404, with
  zero CSP violations and no un-nonced inline scripts.
- Home page no longer shows "Supabase: configured" (dev builds only).
- Styled `not-found.tsx` and `error.tsx` (error shows only Next's digest).
- `robots.txt` disallows all and pages are `noindex` while data is sample-only.
- `/.well-known/security.txt` pointing to GitHub private vulnerability
  reporting.
- Skip-to-content link, `:focus-visible` ring, link gold darkened to `#7a5f17`.
- Next.js 16.4.2 → 16.4.6 and `eslint-config-next` to match (npm advisory
  GHSA-mfr8-8qww-v76h; didn't affect this app, which doesn't use `use cache`),
  plus `npm audit fix` for a dev-only lint dependency. `npm audit`: 0.

**Repo check of review item S2 (full live check is 22b):** all 20 tables have
RLS enabled; `anon` has no grants on any base table (migration 013) and reads
only `public_*` views; there are no `"use client"` data components, no
`service_role` key anywhere, and the public page reads only the views.

**Files:** `proxy.ts`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`,
`app/globals.css`, `app/not-found.tsx` (new), `app/error.tsx` (new),
`app/robots.ts` (new), `public/.well-known/security.txt` (new),
`package.json`, `package-lock.json`, `BACKLOG.md`. **Size:** about 250 lines
plus the backlog section.

**Checks:** typecheck, lint, build pass; `check:public-page` passes; header
scan of `/`, `/p`, passport, 404, `/edit` shows all headers and no
`x-powered-by`.

**Questions for Travis:**
1. `security.txt` points to GitHub's private vulnerability reporting. Turn it
   on in the repo (Settings → Security → Private vulnerability reporting), or
   give an address to use instead.
2. In Vercel, check that Deployment Protection is on for preview deployments
   (Settings → Deployment Protection), so branch builds aren't public.
3. The "The roof has been repaired." statement dated Nov 16 on the sample is
   probably your test from setup night; the date is a day ahead because the
   server uses UTC (fixed in 22d). Delete it in Supabase if you don't want it.

**Next:** 22b, live access audit and anon-key check.

## 2026-11-17 — Run 44: Item 22b, access audit

**Built:**
- `docs/security-policies.md`: every role, all 20 base tables (anon / signed-in
  non-editor / editor rights and why), all 18 `public_*` views with the exact
  columns they expose and the private columns they leave out, functions
  callable over `/rpc`, and rules for adding new tables, views and functions.
- `npm run check:anon-access` (`scripts/check-anon-access.mjs`): read-only live
  check with the anon key. Expects every base table to be refused, every view
  readable with only documented columns, `compute_assertion_status` refused and
  `is_editor()` false. Refuses to run with a service/secret key; prints SKIPPED
  without env vars (so it can sit in CI later).
- Payload check: `check:public-page` now also fetches the RSC payload
  (`RSC: 1`) and scans it for private sample values. Confirmed all passport
  components are Server Components (only `app/error.tsx` is a client file), so
  view rows aren't serialized to the browser; unshown columns (ids,
  `storage_path`) stay on the server.

**Files:** `docs/security-policies.md` (new), `scripts/check-anon-access.mjs`
(new), `scripts/check-public-page.mjs`, `package.json`, `README.md`,
`BACKLOG.md`. **Size:** about 330 lines, mostly the doc.

**Checks:** typecheck, lint, build pass; `check:public-page` passes (HTML +
RSC). `check:anon-access` could not run live here: this nightly run has no
Supabase env vars and can't reach the preview site.

**Found while auditing (no change needed now):** Postgres lets anyone call
public functions over `/rpc`; the only one that reads data,
`compute_assertion_status`, runs as the caller so anon is refused. 22c must add
`audit_log` to the anon revoke list and the check script's table list.

**Questions for Travis:**
1. Please run `npm run check:anon-access` once with the test project's URL and
   anon key in `.env.local` and paste the output (or any FAILED lines) into the
   next log entry or a note; that's the "live" half of 22b.

**Next:** 22c, append-only audit log.

## 2026-11-17 — Follow-up from Travis (on request)

Travis confirmed: GitHub private vulnerability reporting is on (the
`security.txt` contact works), Vercel Deployment Protection is set to
Standard Protection for preview builds, and 2FA is on for his Vercel account.
Questions 1 and 2 from session 43 are closed. He's keeping the test statement
"The roof has been repaired." in the sample data for now; its date shows one
day ahead until item 22d (project time zones) is done.

## 2026-11-17 — Session 44 (20-minute session requested by Travis): items 22c, 22d, 23a, 23b, 23c, 23e, 23f, 23g, 23j, 23l

Ten items from the site-review section, in backlog order except that 23d
(share images), 23h (rename sample data), 23i (evidence display) and 23k
(mobile/dark pass) were left for nightly runs; each needs more than a few
minutes or touches the live data.

**22c — audit log (migration 014).** `audit_log` records every insert, update
and delete on all 20 tables (who, when, table, row, old row, new row), written
only by triggers. Editors can read it; nobody can write through the API, and a
guard trigger refuses update/delete/truncate for every role. Status changes
made by the status trigger are logged too. Tested on a local Postgres 16 with
stubbed Supabase roles: editor insert + document produced three log rows
including claim → documented; editor/anon/non-editor tampering and reads all
refused; superuser delete and truncate refused.

**22d — project time zone (migration 015).** `projects.timezone` (IANA name,
validated, default UTC; sample = Africa/Kampala), exposed on
`public_projects`. Editor forms use the project's local date for "today", the
default date, and the not-in-the-future check (read from the database, not the
form); a statement with no date gets the project's local date in the database
too. Passport pages say which zone the dates are in. The app tolerates a
database without the column, so it deployed safely before the upgrade is run.

**Upgrade file for the live test database:**
`supabase/upgrades/20261117_014_015_audit_log_timezone.sql` (014 + 015 +
sample time zone, one transaction). Tested as an upgrade on a database built
from migrations 001–013 and as part of a fresh full setup;
`public_views_no_private_columns.sql` passes after both.

**23a — summary band** under the passport title: counts of verified /
documented / claim with a proportional bar ("Counts are context, not a
rating"), approved / received / spent with bars, a "needs review" chip linking
to the flags, and the latest dated entry.
**23b — type:** self-hosted Source Serif 4 for headings (file in `app/fonts/`,
OFL licence alongside; Google Fonts isn't contacted, so CSP stays
`font-src 'self'`), larger h1/h2/h3 with a gold tick above each h2, no text
under 13.6px (was 73 nodes at 12.8px), tabular numbers.
**23c — chrome:** header with a ○ ◐ ● wordmark (inline SVG), Projects and How
it works links; footer with purpose, legend and the sample-data/money notice;
`app/icon.svg`; `theme-color` for light and dark.
**23e — section navigation:** sticky "On this page" rail at ≥1180px, a
collapsible list under the summary on smaller screens, back-to-top link. No
client JavaScript, so the current section is not highlighted.
**23f — landing page:** tagline as the headline, primary button, three-state
explainer with an example statement from the sample, preview card.
**23g — project cards:** status, sample tag, title, organization, region,
dates, status bar and counts, spent-of-approved bar; whole card clickable with
hover and focus states; empty state. Search/filter left until there are
enough projects to need it.
**23j — tables:** hidden captions, "No statement" as a neutral outlined pill,
row hover, spent-vs-approved bar on each budget line, wider purchase
description column.
**23l — print stylesheet:** hides navigation, keeps rows and cards together,
totals only after the last row, prints status colours, adds a "printed from"
note. Checked by rendering the sample passport to a 7-page A4 PDF.

**Files:** migrations 014, 015 and the upgrade file (new);
`app/components/passport/Summary.tsx`, `app/components/ProjectCard.tsx`,
`app/icon.svg`, `app/fonts/*` (new); `app/layout.tsx`, `app/page.tsx`,
`app/p/page.tsx`, `app/globals.css`, `app/components/passport/PassportView.tsx`,
`Ledger.tsx`, `Results.tsx`, `app/edit/[slug]/page.tsx`, `actions.ts`,
`lib/format.ts`, `lib/passport.ts`, `lib/types.ts`, `lib/sample/passport.json`,
`supabase/seed.sql`, `scripts/check-anon-access.mjs`, `docs/security-policies.md`,
`docs/data-model.md`, `docs/setup.md`, `BACKLOG.md`. **Size:** about 1,100 lines.

**Checks:** typecheck, lint, build pass; `check:public-page` (HTML + RSC) and
`check:fixture` pass; no CSP violations or console errors in a headless
browser on `/`, `/p` and the passport at 1280px and 375px, light and dark; no
horizontal scroll at 375px. Not checked: the live site after deploy, and the
editor pages against the live database.

**Questions for Travis:**
1. Run `supabase/upgrades/20261117_014_015_audit_log_timezone.sql` once in the
   Supabase SQL Editor, then update the table in `docs/setup.md` (or tell
   Claude). Until then there is no audit trail and dates still use UTC.
2. Still open from 22b: `npm run check:anon-access` against the test project.
   After the upgrade it also checks `audit_log` and the new `timezone` column.
3. The footer has no contact line yet. What address (or none) should it show?
4. Editor dates now follow the project's time zone (Kampala for the sample),
   so in the US evening "today" is still the next calendar day there. Say if
   you'd rather the forms default to the editor's own date.

**Next:** 23d, share previews (Open Graph image per passport).
