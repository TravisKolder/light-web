# Pilot readiness — Project Passport prototype

Status as of 2026-10-30. Items 0–19 of `BACKLOG.md` are built. Everything
shown here uses **entirely fictional sample data**.

## What you can see today

Run `npm install && npm run dev`, then open:

| Page | What it shows |
|------|---------------|
| `/` | Short intro and the Claim / Documented / Verified legend |
| `/p` | Public list of Project Passports with counts of verified, documented, and claimed statements |
| `/p/sample-kibira-classroom-block` | The full public Passport for the sample project |

The public Passport, top to bottom:

1. **Header**: project, status, location, dates, reporting currency.
2. **Responsible organization** and **local leaders** (names only for people
   who chose a public profile).
3. **The need** and **objectives**.
4. **Needs review**: automatic consistency checks (e.g. payments with no
   receipt). Prompts for a person to look at, never verdicts.
5. **Budget and spending**: approved vs. spent vs. remaining per line;
   funds received by source type (never the giver's identity), with the
   original currency and exchange rate; purchases and what was paid.
6. **Claims, evidence, and verification**: every statement with its status,
   its supporting documents/evidence, and any independent verification.
7. **Progress reports** (setbacks shown openly), **outcomes**, **lessons**,
   **sustainability**.
8. **Kingdom Return**: Multiplication, Subtraction, Stewardship,
   Sustainability, Restoration as narrative linked to evidence. No score.

Screenshots: [`screenshots/projects-index.png`](screenshots/projects-index.png),
[`screenshots/passport-desktop.png`](screenshots/passport-desktop.png),
[`screenshots/passport-phone-dark.png`](screenshots/passport-phone-dark.png).

## How trust is protected

- **Three states, never merged.** A statement starts as a *claim*. A document
  or piece of evidence makes it *documented*. Only a confirmed check by an
  independent person makes it *verified*. The database enforces this; nobody,
  editors included, can set a status by hand.
- **Independence.** A verifier is rejected if they are a leader, beneficiary,
  donor, supplier contact, report or Kingdom Return author, or supplied a
  claim, document, or evidence for that project. They also sign an
  independence declaration for ties the database can't see.
- **Privacy.** The public site reads only `public_*` views. Donor, worker,
  and beneficiary details, contact details, GPS, payment references, files
  containing personal data, and photos of identifiable people are never
  public. Two automated checks guard this:
  `supabase/checks/public_views_no_private_columns.sql` and
  `npm run check:public-page`.
- **Money is only recorded.** No payments, donations, tokens, or blockchain.

## Steps to run the pilot on a real project

1. Create the Supabase project (or confirm the existing one) and apply the
   migrations in `supabase/migrations/` in order.
2. Run the privacy check script against it.
3. Travis and John sign up through Supabase Auth; add both to
   `public.editors` (README shows the SQL).
4. Choose the real project; enter it with `visibility = 'private'` until
   the record has been reviewed.
5. Arrange an independent verifier for at least one key claim.
6. Review the "Needs review" list, then switch the project to `public`.

## Open questions for Travis and John

1. **Which real project** goes first, and who is its local lead?
2. **Supabase project**: use a new one for the pilot, or an existing one?
   (Still open from Run 1.)
3. **Data entry**: there's no editing screen yet. For the pilot, is entering
   data in the Supabase table editor acceptable, or is a simple entry form the
   next priority?
4. **Files**: where should receipts and photos be stored (Supabase Storage is
   the natural choice), and who uploads them on the ground?
5. **Verifiers**: who could serve as an independent verifier for the pilot,
   and should verifier names be public by default?
6. **Kingdom Return wording**: are the five guiding questions on the page
   the right ones for John's framework?
7. **Thresholds**: is 60 days the right time before an unsupported claim is
   flagged for review?
