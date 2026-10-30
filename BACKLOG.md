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
- [ ] 5b. Migration 003b: `suppliers` (contact details private), `purchases` linked to budget lines, `payments` linked to purchases (reference number private). Extend the verifier-independence check to donors (`funds_received.donor_person_id`) and supplier contacts.
- [ ] 6. Migration 004: `evidence_items` (photo/receipt/report metadata, link to assertion), `progress_reports`, `outcomes`, `lessons`, `sustainability_plans`.
- [ ] 7. Migration 005: `kingdom_return_entries` — dimension enum (Multiplication, Subtraction, Stewardship, Sustainability, Restoration), narrative text, linked assertions/evidence. No numeric score column.
- [ ] 8. Row Level Security: public (anon) can read only rows/columns flagged public; private fields (people contact info, donor details, beneficiary details) exposed only via a `public_*` view set. Document in `docs/data-model.md`.
- [ ] 9. Shared TypeScript types for the data model (`lib/types.ts`) and a status badge component showing Claim / Documented / Verified distinctly.
- [ ] 10. Seed data: one fictional sample project (e.g. a fictional village school build) with leaders, budget, a few purchases, evidence, one verification, and Kingdom Return entries. All fictional; mark clearly.
- [ ] 11. Local fallback: load the seed data from a JSON fixture when Supabase isn't configured, so pages render in dev/preview.
- [ ] 12. Project record page `/projects/[slug]`: header, organization, local leaders (public fields only), need, objectives.
- [ ] 13. Budget-vs-actual ledger section: per budget line approved vs. spent vs. remaining, totals, funds received; each line shows its assertion status.
- [ ] 14. Evidence list section: evidence items grouped by assertion, with status badges and verification details.
- [ ] 15. Progress reports, outcomes, lessons learned, and sustainability sections.
- [ ] 16. Kingdom Return section: five dimensions as narrative + linked evidence, explicitly no score.
- [ ] 17. Public read-only view `/p/[slug]` using only the public views; add a test/check that private fields never appear in its output.
- [ ] 18. Projects index page listing projects with status summary.
- [ ] 19. Simple consistency flags (non-AI first): e.g. spent > approved, payment without receipt, claim with no document — shown as "needs review", never as verdicts.
- [ ] 20. Pilot readiness pass: README walkthrough, screenshots, open questions for Travis and John.
