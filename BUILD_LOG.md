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
