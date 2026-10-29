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
