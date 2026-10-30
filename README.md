# Light Web — Project Passport prototype

The **Light Web** is a concept from John Gross (see
[`docs/light-web-proposal-john-gross.txt`](docs/light-web-proposal-john-gross.txt)):
a way to verify Kingdom work, protect generosity from deception, and help
trustworthy ministries produce lasting fruit.

This repo builds the first, small piece: a **Project Passport** for one
ministry project (proposal sections 4, 6 and 7). A Passport records:

- the responsible organization and local leaders
- the need being addressed
- the approved budget and funds received
- suppliers, purchases, and payments (budget vs. actual)
- evidence of delivery and completed work
- independent verification
- progress reports, outcomes, lessons learned, and sustainability plans
- **Kingdom Return** — Multiplication, Subtraction, Stewardship,
  Sustainability, Restoration — recorded as evidence and narrative, **never a
  numeric score**

## Ground rules

- Every assertion carries one of three distinct states: **claim**,
  **supporting document**, or **independently verified result**.
- Money is only *recorded*, never moved or solicited. No tokens, crypto,
  blockchain, donations, or payments.
- Donor, worker, and beneficiary personal details are private by default and
  never appear on public views. Sample data is fictional.
- AI features (if any) assist review and flag inconsistencies; they never
  issue verdicts.

## Stack

Next.js (App Router, TypeScript) · Supabase · Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

The app builds and runs without Supabase configured; data features will
light up once the env vars are set.

Scripts: `npm run dev`, `npm run build`, `npm run typecheck`.

## Database

Migrations live in `supabase/migrations/`. `supabase/seed.sql` loads one
**entirely fictional** sample project (a village classroom block) for
demos. After migrating, run
`supabase/checks/public_views_no_private_columns.sql` to confirm no private
column is exposed by a public view.

**Editors.** For the pilot only Travis and John edit. After each has signed
up through Supabase Auth, add them in the Supabase SQL editor:

```sql
insert into public.editors (user_id, display_name)
select id, 'Travis' from auth.users where email = '<travis-login-email>';
```

Without Supabase configured, the app serves the same sample from
`lib/sample/passport.json` (public fields only). Regenerate it after editing
the seed with `scripts/export-sample-fixture.sql`, and run
`npm run check:fixture` to confirm it holds no private fields.

`npm run build && npm run check:public-page` serves the public page
(`/p/sample-kibira-classroom-block`) and fails if any private sample value
(names, contacts, donor or payment references, private files) appears in it.

## Working notes

- [`BACKLOG.md`](BACKLOG.md) — ordered checklist of small, one-night items.
- [`BUILD_LOG.md`](BUILD_LOG.md) — dated log of each build session.
