# Backlog — Project Passport prototype

Ordered. Each item should fit one small nightly session. Take the first
unchecked item. Split anything that turns out larger.

- [x] 0. Scaffold Next.js + TypeScript app, Supabase client via env vars, README, BACKLOG, BUILD_LOG.
- [x] 1. Add ESLint (flat config, `eslint-config-next`) with an `npm run lint` script; fix any findings.
- [x] 2. Write `docs/data-model.md`: entities, fields, which fields are private, and the claim/document/verified status rule.
- [x] 3. Migration 001: `organizations`, `people` (private by default), `projects` (need, objectives, status), `project_leaders` link table.
- [x] 4a. Migration 002: `assertions` (status enum `claim`/`documented`/`verified`, default `claim`), `documents`, `verifications` (verifier, dates, method, finding, independence declaration, tie flag). Tables + constraints only.
- [x] 4b. Migration 002b: triggers — (1) keep `assertions.status` in sync with documents/verifications (only confirmed, unflagged verifications count; status drops back when rows are removed or flagged); (2) reject a verifier who appears in the project's existing records (`project_leaders`, `assertions.asserted_by`, `documents.uploaded_by`). Later migrations (003–005) extend the independence check to donors, supplier contacts, report authors, KR authors.
- [x] 5a. Migration 003a: `budget_lines` (approved amount, category) and `funds_received` (amount, date, source category; donor identity columns private). Currency rule columns + same-currency trigger; assertion must be in the same project.
- [x] 5b. Migration 003b: `suppliers` (contact details private), `purchases` linked to budget lines, `payments` linked to purchases (reference number private). Extend the verifier-independence check to donors (`funds_received.donor_person_id`) and supplier contacts.
- [x] 6a. Migration 004a: `evidence_items` (metadata, required link to assertion, private GPS, `shows_identifiable_people`) and `progress_reports`; independence check extended to report authors.
- [x] 6b. Migration 004b: `outcomes`, `lessons`, `sustainability_plans`.
- [x] 7. Migration 005: `kingdom_return_entries` — dimension enum (Multiplication, Subtraction, Stewardship, Sustainability, Restoration), narrative text, linked assertions/evidence. No numeric score column.
- [x] 8a. Public views for projects, organizations, leaders, assertions, and the ledger (budget lines, funds received, purchases, payments, budget-vs-actual). Base tables stay unreadable to anon.
- [x] 8b. Public views for documents (kind/title; no personal-data paths), verifications (finding/method/date; verifier name only with public profile), evidence (no GPS, nothing showing identifiable people), progress reports, outcomes, lessons, sustainability, Kingdom Return + links. Add a SQL check script that fails if any PRIVATE-commented column appears in a public_* view.
- [x] 9. Shared TypeScript types for the data model (`lib/types.ts`) and a status badge component showing Claim / Documented / Verified distinctly.
- [x] 10. Seed data: one fictional sample project (e.g. a fictional village school build) with leaders, budget, a few purchases, evidence, one verification, and Kingdom Return entries. All fictional; mark clearly.
- [x] 11. Local fallback: load the seed data from a JSON fixture when Supabase isn't configured, so pages render in dev/preview.
- [x] 11b. Editor access, pilot version (Travis, 2026-10-30: start with just Travis and John, widen later): an `editors` table of Supabase auth user ids with RLS policies giving editors read/write on all base tables. Designed so it can later gain an `organization_id` and role to scope ministry staff. Document in `docs/data-model.md`.
- [x] 12. Project record page `/projects/[slug]`: header, organization, local leaders (public fields only), need, objectives.
- [x] 13. Budget-vs-actual ledger section: per budget line approved vs. spent vs. remaining, totals, funds received; each line shows its assertion status.
- [x] 14. Evidence list section: evidence items grouped by assertion, with status badges and verification details.
- [x] 15. Progress reports, outcomes, lessons learned, and sustainability sections.
- [x] 16. Kingdom Return section: five dimensions as narrative + linked evidence, explicitly no score.
- [x] 17. Public read-only view `/p/[slug]` using only the public views; add a test/check that private fields never appear in its output.
- [x] 18. Projects index page listing projects with status summary.
- [x] 19. Simple consistency flags (non-AI first): e.g. spent > approved, payment without receipt, claim with no document — shown as "needs review", never as verdicts.
- [x] 20. Pilot readiness pass: README walkthrough, screenshots, open questions for Travis and John.

> Test Supabase project and Vercel preview set up by Travis on 2026-11-16
> (`docs/setup.md`). New editor forms can now be tried live at
> https://light-web-theta.vercel.app/edit.

## Site review fixes (Travis approved 2026-11-17)

From the external site review (security + visual design, 2026-11-15). Travis
asked for these ahead of the remaining editor forms, most important holes
first. Item 22a was done in the same session as the review.

- [x] 22a. Security quick wins: security headers on every route (CSP with per-request nonce, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), no `x-powered-by`, no browser source maps; remove the "Supabase: configured" line from the public home page; styled 404 and error pages; `robots.txt` disallow + `noindex` while data is sample-only; `/.well-known/security.txt`; skip link and `:focus-visible` ring; slightly darker link gold; Next.js 16.4.6 (advisory fix).
- [x] 22b. Access audit, live: `docs/security-policies.md` (every table and view: who can select/insert/update/delete, and why) plus `npm run check:anon-access`, a script that uses the anon key (from env) to query every base table (expect no access) and every `public_*` view (expect only the documented columns). Also confirm the passport page's server-rendered payload carries nothing it doesn't show.
- [x] 22c. Append-only audit log: `audit_log` table (who, when, table, row id, old value, new value) filled by triggers on every base table; no update/delete for anyone through the API; editors can read it. Before more editor forms, so every edit from now on leaves a trail.
- [x] 22d. Dates and time zone: give each project a local time zone, use it (not UTC) for the editor forms' default "today" and future-date checks, and label dates on passport pages. (A statement entered in the US evening was dated the next day because the server uses UTC.)
- [x] 23a. Passport summary band under the title: Claim / Documented / Verified counts with a segmented bar, money at a glance (approved, received, spent), "needs review" chip linking to the flags, last-updated date.
- [x] 23b. Type and hierarchy: larger h1/h2/h3 scale with spacing, a self-hosted serif heading font via `next/font` (keeps the CSP tight), minimum 14px text, tabular numbers in money columns.
- [x] 23c. Site chrome: slim header (wordmark using the ○ ◐ ● progression, Projects, How it works), footer (purpose, status legend, contact, sample-data notice), favicon/app icon, `theme-color`.
- [x] 23d. Share previews: Open Graph/Twitter metadata and a generated share image per passport (title + status counts).
- [x] 23e. Section navigation on the passport: `id`s on every section heading, sticky "On this page" rail on wide screens, collapsible list on narrow screens, back-to-top.
- [x] 23f. Landing page: tagline as the headline, three-column Claim → Documented → Verified explainer with an example from the sample, a preview card of the sample passport, and a primary button style.
- [x] 23g. Projects index as cards: title, organization, region, dates, segmented status bar, budget progress; whole card clickable with hover/focus states; empty state.
- [x] 23h. Mark sample data once: one banner on the passport and a "Sample" tag on its card; remove the inline "SAMPLE"/"(fictional)" repeats from the seed data (fixture + a SQL update for the test database).
- [x] 23i. Evidence that looks like evidence: type icon, date and place on each item, lock icon + privacy note on private items. (Thumbnails and a viewer wait for file uploads.)
- [x] 23j. Tables polish: hidden captions, wider description column, "No statement" as a neutral outlined pill, row hover, approved-vs-spent bars on budget lines.
- [x] 23k. Mobile and dark-mode pass: screenshot every page at 360/390/768px and in dark mode, fix what breaks, stacked rows for tables under 520px; confirm the public pages ship no unnecessary client JavaScript.
- [x] 23l. Print stylesheet for passports: hide navigation, avoid splitting table rows, print URL and date.
- [x] 24. CI guardrails: GitHub Actions running typecheck, lint, build, the public-page leak check, a header check, and a build-output scan that fails on `service_role`/`sb_secret_`/service JWTs; Dependabot for npm.

Later, with file uploads (separate proposal): content-sniffed type allowlist, size cap, strip EXIF/GPS from photos, random stored names, private bucket with short-lived signed URLs.

## Editor forms (Travis approved 2026-11-12)

Signed-in editors only. Forms record data; the database still sets every claim/documented/verified status and runs the independence checks, so the forms never set a status by hand. No file uploads yet (that's a separate proposal).

- [x] 21a. Editor sign-in: Supabase Auth email magic link, session handling, and an `/edit` area that only opens for users in `public.editors`. Shows a clear "Supabase not configured" message in local fallback mode. Lists projects to edit.
- [x] 21b. `/edit/[slug]` statements: list the project's assertions with their status badges, plus a form to add a new assertion (statement, asserted by, date). Server action with validation; status is read-only.
- [x] 21c1. Document metadata form on `/edit/[slug]`, linked to one of the project's statements (kind, title, date issued, supplied by, `contains_personal_data`). Metadata only, no file upload. (Split from 21c, 2026-11-14.)
- [x] 21c2. Evidence metadata form linked to a statement (kind, caption, date captured, location label, supplied by, `shows_identifiable_people`, private GPS pair). Metadata only, no file upload.
- [x] 21d. Ledger forms, part 1: budget lines and funds received (source category; donor identity optional and private). Show the database's currency-rule errors in plain language.
- [x] 21e. Ledger forms, part 2: purchases (linked to a budget line) and payments (private reference number).
- [x] 21f. Verification form: record an independent verification with a required independence declaration; show the database's independence rejection in plain language.

## Rest of the passport, corrections and history (Travis approved 2026-11-17)

Proposals 1 and 2 from the "backlog complete" note. File uploads (proposal 3)
wait for a separate go-ahead and a storage bucket.

- [x] 25a. Results forms on `/edit/[slug]/results`: progress reports (period, summary, setbacks, author, linked statement), outcomes (description, measure, target, achieved, linked statement), lessons learned, sustainability plan.
- [x] 25b. Kingdom Return form on `/edit/[slug]/kingdom-return`: one narrative entry per dimension at a time, linked to statements and evidence. No score, ever.
- [x] 26a. History: `/edit/[slug]/history` shows the project's change log from `audit_log` (who, when, what changed, old → new), filterable by kind of record.
- [x] 26b1. Corrections, editor side (split from 26b, 2026-11-19): migration 017 (correction/withdrawal reason + timestamps on `assertions`, trigger rules), correct and withdraw forms on `/edit/[slug]` with a required reason; withdrawn statements stay listed, marked withdrawn; history keeps old wording.
- [x] 26b2. Corrections, public side: add withdrawn/corrected (date, reason) to `public_assertions` and the sample fixture; passport pages show withdrawn statements as withdrawn (struck through, with reason) and a "corrected" note; review flags skip withdrawn statements. Withdrawal and correction reasons are public (Travis, 2026-11-19); add a note on the editor forms that reasons appear on the public passport, so no private details.
- [x] 26c. People, leaders and organization: add a person (display name, role, public or not; private contact details optional), list and add project leaders, edit the organization's public description and the project's need and objectives.

## File uploads (Travis approved 2026-11-19)

Proposal 2 from the "backlog complete" note, chosen first. Files are
evidence, not payments: nothing here moves money. Private by default; the
public passport only ever gets a short-lived link to a file the public views
already allow (documents without personal data, evidence without
identifiable people). Travis runs each new upgrade file; nothing touches
Supabase project settings.

- [x] 27a. Storage foundation: migration 019 creates a private `evidence` bucket (not public; size limit and allowed types set on the bucket) and storage policies so only editors can upload, read and delete; anon gets nothing. Upgrade file, `docs/security-policies.md`, and `check:anon-access` extended to confirm anon can't list or read the bucket.
- [x] 27b. Upload a file with a document: on the statement page's document form, an optional file (PDF, JPEG, PNG, WebP; 10 MB cap). Server action checks the real type from the file's first bytes (not the name or browser's claim), re-encodes images to strip EXIF/GPS, stores under a random name, and sets `documents.storage_path`. Editors only.
- [x] 27c. Upload a photo with an evidence item: same checks and EXIF/GPS stripping; if the photo carried GPS, offer it to fill the item's private GPS fields (never public).
- [x] 27d1. Viewing files, editor side (split from 27d, 2026-11-23): each statement on `/edit/[slug]` lists its attached documents and evidence; those with a file get an "Open file" link to an editor-only server route that re-checks the session and the row, signs a 60-second URL, and redirects (no-store, no referrer).
- [x] 27d2. Viewing files, public side: the public passport shows thumbnails/download links only for files the public views expose, served via a server route that re-checks the public view and signs a 60-second URL. Extend `check:public-page` so no private file path or URL appears.
- [ ] 27e. Replace or remove a file (logged in `audit_log`, old file deleted from storage), and a storage note in `docs/data-model.md` and the README.

