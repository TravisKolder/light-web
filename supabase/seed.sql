-- ============================================================================
-- SAMPLE DATA — ENTIRELY FICTIONAL
-- ============================================================================
-- One fictional Project Passport: a two-classroom block for a village primary
-- school. Every organization, person, place, supplier, amount, and event
-- below is invented for demonstration. Any resemblance to real people or
-- organizations is coincidental. Phone numbers use the reserved 555 range and
-- e-mail addresses use the reserved .example domain.
--
-- Backlog item 10. Load after migrations (Supabase CLI runs supabase/seed.sql
-- on `supabase db reset`). Uses fixed UUIDs so pages and tests can refer to
-- rows. Assertion statuses are NOT set here: the triggers derive them from
-- the documents, evidence, and verifications below.
--
-- Expected statuses after loading:
--   Budget approved by board ............ documented (board minutes)
--   Funds received ...................... documented (bank statement)
--   Cement purchased and paid ........... documented (receipt)
--   Roofing sheets purchased and paid ... documented (invoice; contains personal data)
--   Classroom roof completed ............ verified   (photo + independent site visit)
--   120 pupils taught indoors ........... documented (photo; private, shows children)
--   Parents' committee maintains block .. claim
-- ============================================================================

-- IDs: all sample rows use 00000000-5a3e-4000-8000-xxxxxxxxxxxx ("5a3e" ≈ "sample").

-- ---------------------------------------------------------------------------
-- Organization and project
-- ---------------------------------------------------------------------------
insert into public.organizations
  (id, name, country, region, description, website,
   registration_number, contact_email, contact_phone, address_line)
values
  ('00000000-5a3e-4000-8000-000000000001',
   'Hillside Hope Fellowship (SAMPLE)', 'UG', 'Eastern Region (fictional)',
   'Fictional local church network used as sample data.', null,
   'SAMPLE-REG-0001', 'office@hillside-hope.example', '+256 555 0100',
   'P.O. Box 0, Fictional Town');

insert into public.projects
  (id, slug, title, organization_id, country, region, need_statement,
   objectives, status, start_date, end_date, base_currency, visibility)
values
  ('00000000-5a3e-4000-8000-0000000000a1',
   'sample-kibira-classroom-block',
   'SAMPLE: Kibira Village Primary School classroom block',
   '00000000-5a3e-4000-8000-000000000001',
   'UG', 'Eastern Region (fictional)',
   'The fictional Kibira village primary school teaches 180 pupils in two '
   'rooms and under a tree. In the rainy season outdoor classes stop.',
   array['Build a two-classroom block with a durable iron-sheet roof',
         'Furnish both rooms with desks for 80 pupils',
         'Hand maintenance to the parents'' committee'],
   'active', '2026-02-01', '2026-11-30', 'USD', 'public');

-- ---------------------------------------------------------------------------
-- People (private by default; only display_name/role_title of public
-- profiles are ever shown)
-- ---------------------------------------------------------------------------
insert into public.people
  (id, display_name, role_title, public_profile, is_beneficiary,
   full_name, email, phone)
values
  ('00000000-5a3e-4000-8000-0000000000c1', 'Pastor Samuel O.', 'Local project lead', true,  false,
   'Samuel Okello (fictional)', 'samuel@hillside-hope.example', '+256 555 0101'),
  ('00000000-5a3e-4000-8000-0000000000c2', 'Treasurer', 'Church treasurer', false, false,
   'Grace Auma (fictional)', 'grace@hillside-hope.example', '+256 555 0102'),
  ('00000000-5a3e-4000-8000-0000000000c3', 'Ruth N.', 'Independent site verifier', true, false,
   'Ruth Nambozo (fictional)', 'ruth@verifier.example', '+256 555 0103'),
  ('00000000-5a3e-4000-8000-0000000000c4', 'Donor', null, false, false,
   'Fictional Donor', 'donor@giving.example', '+1 555 0104'),
  ('00000000-5a3e-4000-8000-0000000000c5', 'Supplier contact', null, false, false,
   'Fictional Shopkeeper', 'shop@hardware.example', '+256 555 0105'),
  ('00000000-5a3e-4000-8000-0000000000c6', 'Head teacher', 'Head teacher, Kibira P.S.', false, false,
   'Fictional Head Teacher', 'head@kibira-ps.example', '+256 555 0106');

insert into public.project_leaders (project_id, person_id, role, since) values
  ('00000000-5a3e-4000-8000-0000000000a1', '00000000-5a3e-4000-8000-0000000000c1', 'local_lead', '2026-01-15'),
  ('00000000-5a3e-4000-8000-0000000000a1', '00000000-5a3e-4000-8000-0000000000c2', 'treasurer',  '2026-01-15');

-- ---------------------------------------------------------------------------
-- Independent verification happens in the timeline after the build, but the
-- independence trigger checks the project's records at the moment the
-- verification is written. Insert the verifier's work last (see bottom).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Assertions (statuses derived by trigger)
-- ---------------------------------------------------------------------------
insert into public.assertions (id, project_id, statement, asserted_by, asserted_on) values
  ('00000000-5a3e-4000-8000-0000000000b1', '00000000-5a3e-4000-8000-0000000000a1',
   'The board approved a budget of USD 10,000 for the classroom block.',
   '00000000-5a3e-4000-8000-0000000000c1', '2026-01-20'),
  ('00000000-5a3e-4000-8000-0000000000b2', '00000000-5a3e-4000-8000-0000000000a1',
   'The project received USD 5,000 and UGX 3,700,000 in gifts.',
   '00000000-5a3e-4000-8000-0000000000c2', '2026-02-10'),
  ('00000000-5a3e-4000-8000-0000000000b3', '00000000-5a3e-4000-8000-0000000000a1',
   '40 bags of cement were bought and paid for.',
   '00000000-5a3e-4000-8000-0000000000c2', '2026-03-05'),
  ('00000000-5a3e-4000-8000-0000000000b4', '00000000-5a3e-4000-8000-0000000000a1',
   '60 iron roofing sheets were bought and paid for.',
   '00000000-5a3e-4000-8000-0000000000c2', '2026-05-12'),
  ('00000000-5a3e-4000-8000-0000000000b5', '00000000-5a3e-4000-8000-0000000000a1',
   'The roof of the two-classroom block is complete.',
   '00000000-5a3e-4000-8000-0000000000c1', '2026-06-30'),
  ('00000000-5a3e-4000-8000-0000000000b6', '00000000-5a3e-4000-8000-0000000000a1',
   '120 pupils are now taught indoors in the new block.',
   '00000000-5a3e-4000-8000-0000000000c1', '2026-09-15'),
  ('00000000-5a3e-4000-8000-0000000000b7', '00000000-5a3e-4000-8000-0000000000a1',
   'The parents'' committee has taken on maintenance of the block.',
   '00000000-5a3e-4000-8000-0000000000c1', '2026-10-01');

insert into public.documents
  (id, assertion_id, kind, title, issued_on, uploaded_by, contains_personal_data, storage_path)
values
  ('00000000-5a3e-4000-8000-0000000000d1', '00000000-5a3e-4000-8000-0000000000b1',
   'report', 'Board minutes approving the budget (SAMPLE)', '2026-01-20',
   '00000000-5a3e-4000-8000-0000000000c1', false, 'sample/board-minutes.pdf'),
  ('00000000-5a3e-4000-8000-0000000000d2', '00000000-5a3e-4000-8000-0000000000b2',
   'bank_statement', 'Bank statement, February 2026 (SAMPLE)', '2026-02-28',
   '00000000-5a3e-4000-8000-0000000000c2', true, 'sample/bank-statement-feb.pdf'),
  ('00000000-5a3e-4000-8000-0000000000d3', '00000000-5a3e-4000-8000-0000000000b3',
   'receipt', 'Cement receipt (SAMPLE)', '2026-03-04',
   '00000000-5a3e-4000-8000-0000000000c2', false, 'sample/cement-receipt.jpg'),
  ('00000000-5a3e-4000-8000-0000000000d4', '00000000-5a3e-4000-8000-0000000000b4',
   'invoice', 'Roofing sheets invoice (SAMPLE)', '2026-05-10',
   '00000000-5a3e-4000-8000-0000000000c2', true, 'sample/roofing-invoice.pdf');

-- ---------------------------------------------------------------------------
-- Budget and ledger
-- ---------------------------------------------------------------------------
insert into public.budget_lines
  (id, project_id, category, description, approved_amount, currency,
   exchange_rate, rate_date, rate_source, approved_on, assertion_id)
values
  ('00000000-5a3e-4000-8000-0000000000e1', '00000000-5a3e-4000-8000-0000000000a1',
   'Materials', 'Cement, sand, bricks, roofing', 6000, 'USD', 1, '2026-01-20',
   'same_currency', '2026-01-20', '00000000-5a3e-4000-8000-0000000000b1'),
  ('00000000-5a3e-4000-8000-0000000000e2', '00000000-5a3e-4000-8000-0000000000a1',
   'Labour', 'Local builders cooperative', 3000, 'USD', 1, '2026-01-20',
   'same_currency', '2026-01-20', '00000000-5a3e-4000-8000-0000000000b1'),
  ('00000000-5a3e-4000-8000-0000000000e3', '00000000-5a3e-4000-8000-0000000000a1',
   'Furniture', 'Desks for 80 pupils', 1000, 'USD', 1, '2026-01-20',
   'same_currency', '2026-01-20', '00000000-5a3e-4000-8000-0000000000b1');

insert into public.funds_received
  (id, project_id, amount, currency, exchange_rate, rate_date, rate_source,
   received_on, source_category, assertion_id,
   donor_person_id, donor_name, donor_contact, donor_reference)
values
  ('00000000-5a3e-4000-8000-0000000000f1', '00000000-5a3e-4000-8000-0000000000a1',
   5000, 'USD', 1, '2026-02-03', 'same_currency', '2026-02-03', 'church',
   '00000000-5a3e-4000-8000-0000000000b2',
   null, 'Fictional Partner Church (SAMPLE)', 'missions@partner.example', 'SAMPLE-GIFT-001'),
  ('00000000-5a3e-4000-8000-0000000000f2', '00000000-5a3e-4000-8000-0000000000a1',
   3700000, 'UGX', 0.00027, '2026-02-09', 'bank', '2026-02-09', 'individual',
   '00000000-5a3e-4000-8000-0000000000b2',
   '00000000-5a3e-4000-8000-0000000000c4', 'Fictional Donor', 'donor@giving.example', 'SAMPLE-GIFT-002');

insert into public.suppliers
  (id, name, kind, country, region, contact_person_id, contact_name,
   contact_phone, contact_email, bank_details_note)
values
  ('00000000-5a3e-4000-8000-000000000051', 'Fictional Town Hardware (SAMPLE)', 'business',
   'UG', 'Eastern Region (fictional)', '00000000-5a3e-4000-8000-0000000000c5',
   'Fictional Shopkeeper', '+256 555 0105', 'shop@hardware.example', 'SAMPLE account, not real'),
  ('00000000-5a3e-4000-8000-000000000052', 'Kibira Builders Cooperative (SAMPLE)', 'cooperative',
   'UG', 'Eastern Region (fictional)', null, 'Fictional Foreman', '+256 555 0107', null, null);

insert into public.purchases
  (id, project_id, budget_line_id, supplier_id, description, quantity, unit,
   amount, currency, exchange_rate, rate_date, rate_source, purchased_on, assertion_id)
values
  ('00000000-5a3e-4000-8000-000000000061', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000e1', '00000000-5a3e-4000-8000-000000000051',
   'Cement, 50 kg bags', 40, 'bags', 1110000, 'UGX', 0.00027, '2026-03-04', 'bank',
   '2026-03-04', '00000000-5a3e-4000-8000-0000000000b3'),
  ('00000000-5a3e-4000-8000-000000000062', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000e1', '00000000-5a3e-4000-8000-000000000051',
   'Iron roofing sheets, 28 gauge (replacement batch)', 60, 'sheets', 1800, 'USD', 1,
   '2026-05-10', 'same_currency', '2026-05-10', '00000000-5a3e-4000-8000-0000000000b4'),
  ('00000000-5a3e-4000-8000-000000000063', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000e2', '00000000-5a3e-4000-8000-000000000052',
   'Construction labour, walls and roof', null, null, 2800, 'USD', 1,
   '2026-03-15', 'same_currency', '2026-03-15', null);

insert into public.payments
  (id, project_id, purchase_id, amount, currency, exchange_rate, rate_date,
   rate_source, paid_on, method, assertion_id, reference_number)
values
  ('00000000-5a3e-4000-8000-000000000071', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-000000000061', 1110000, 'UGX', 0.00027, '2026-03-04',
   'mobile_money', '2026-03-04', 'mobile_money', '00000000-5a3e-4000-8000-0000000000b3', 'SAMPLE-MM-0001'),
  ('00000000-5a3e-4000-8000-000000000072', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-000000000062', 1800, 'USD', 1, '2026-05-11',
   'same_currency', '2026-05-11', 'bank_transfer', '00000000-5a3e-4000-8000-0000000000b4', 'SAMPLE-BT-0002'),
  ('00000000-5a3e-4000-8000-000000000073', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-000000000063', 1400, 'USD', 1, '2026-04-01',
   'same_currency', '2026-04-01', 'cash', null, null),
  ('00000000-5a3e-4000-8000-000000000074', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-000000000063', 1400, 'USD', 1, '2026-07-01',
   'same_currency', '2026-07-01', 'cash', null, null);

-- ---------------------------------------------------------------------------
-- Evidence of delivery
-- ---------------------------------------------------------------------------
insert into public.evidence_items
  (id, project_id, assertion_id, kind, caption, captured_on, location_label,
   storage_path, shows_identifiable_people, gps_lat, gps_lng, uploaded_by)
values
  ('00000000-5a3e-4000-8000-000000000081', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000b5', 'photo',
   'Completed roof of the two-classroom block, seen from the school yard (SAMPLE)',
   '2026-06-28', 'Kibira village (fictional)', 'sample/roof-complete.jpg', false,
   null, null, '00000000-5a3e-4000-8000-0000000000c1'),
  ('00000000-5a3e-4000-8000-000000000082', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000b6', 'photo',
   'Pupils in the new classroom on the first day of term (SAMPLE)',
   '2026-09-14', 'Kibira village (fictional)', 'sample/first-day.jpg', true,
   null, null, '00000000-5a3e-4000-8000-0000000000c1');
-- Note: the second photo shows children, so it is private and never public.
-- It still moves "120 pupils" from claim to documented.

-- ---------------------------------------------------------------------------
-- Progress, outcomes, lessons, sustainability
-- ---------------------------------------------------------------------------
insert into public.progress_reports
  (id, project_id, period_start, period_end, summary, setbacks, author_id, assertion_id)
values
  ('00000000-5a3e-4000-8000-000000000091', '00000000-5a3e-4000-8000-0000000000a1',
   '2026-02-01', '2026-06-30',
   'Foundations, walls, and roof completed. Labour paid in two instalments.',
   'The first batch of roofing sheets was thinner than ordered and was returned; '
   'the supplier replaced it, delaying the roof by three weeks.',
   '00000000-5a3e-4000-8000-0000000000c1', '00000000-5a3e-4000-8000-0000000000b5');

insert into public.outcomes (id, project_id, description, measure, target, achieved, assertion_id) values
  ('00000000-5a3e-4000-8000-0000000000a5', '00000000-5a3e-4000-8000-0000000000a1',
   'Pupils taught indoors', 'pupils', '120 pupils', '120 pupils (claimed)',
   '00000000-5a3e-4000-8000-0000000000b6'),
  ('00000000-5a3e-4000-8000-0000000000a6', '00000000-5a3e-4000-8000-0000000000a1',
   'Classroom block with durable roof', 'rooms', '2 rooms', '2 rooms roofed',
   '00000000-5a3e-4000-8000-0000000000b5');

insert into public.lessons (id, project_id, lesson, recorded_on) values
  ('00000000-5a3e-4000-8000-0000000000a7', '00000000-5a3e-4000-8000-0000000000a1',
   'Check roofing sheet gauge on delivery, before paying.', '2026-05-12'),
  ('00000000-5a3e-4000-8000-0000000000a8', '00000000-5a3e-4000-8000-0000000000a1',
   'Buy cement before the rainy season, when prices rise.', '2026-06-30');

insert into public.sustainability_plans
  (id, project_id, plan, funding_after_grant, local_owner, review_on)
values
  ('00000000-5a3e-4000-8000-0000000000a9', '00000000-5a3e-4000-8000-0000000000a1',
   'The parents'' committee inspects the roof after each rainy season and repairs gutters.',
   'A small termly maintenance contribution set by the parents'' committee.',
   'Kibira P.S. parents'' committee (fictional)', '2027-04-30');

-- ---------------------------------------------------------------------------
-- Kingdom Return — narrative + linked evidence, no score
-- ---------------------------------------------------------------------------
insert into public.kingdom_return_entries
  (id, project_id, dimension, narrative, recorded_on, author_id)
values
  ('00000000-5a3e-4000-8000-0000000000b8', '00000000-5a3e-4000-8000-0000000000a1', 'multiplication',
   'Two young members of the builders cooperative learned roofing on this project and '
   'have since been hired for a clinic roof in a neighbouring village.',
   '2026-10-01', '00000000-5a3e-4000-8000-0000000000c1'),
  ('00000000-5a3e-4000-8000-0000000000b9', '00000000-5a3e-4000-8000-0000000000a1', 'subtraction',
   'Classes no longer stop in the rainy season for the 120 pupils now taught indoors.',
   '2026-10-01', '00000000-5a3e-4000-8000-0000000000c1'),
  ('00000000-5a3e-4000-8000-0000000000ba', '00000000-5a3e-4000-8000-0000000000a1', 'stewardship',
   'Materials and labour were bought locally; all spending so far is within the approved budget lines.',
   '2026-10-01', '00000000-5a3e-4000-8000-0000000000c1'),
  ('00000000-5a3e-4000-8000-0000000000bb', '00000000-5a3e-4000-8000-0000000000a1', 'sustainability',
   'The parents'' committee has agreed to maintain the block (not yet documented).',
   '2026-10-01', '00000000-5a3e-4000-8000-0000000000c1'),
  ('00000000-5a3e-4000-8000-0000000000bc', '00000000-5a3e-4000-8000-0000000000a1', 'restoration',
   'Under-gauge roofing sheets were caught, reported openly, returned, and replaced at the '
   'supplier''s cost.',
   '2026-10-01', '00000000-5a3e-4000-8000-0000000000c1');

insert into public.kingdom_return_links (id, project_id, entry_id, assertion_id, evidence_item_id) values
  ('00000000-5a3e-4000-8000-0000000000c7', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000b9', '00000000-5a3e-4000-8000-0000000000b6', null),
  ('00000000-5a3e-4000-8000-0000000000c8', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000ba', '00000000-5a3e-4000-8000-0000000000b3', null),
  ('00000000-5a3e-4000-8000-0000000000c9', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000ba', '00000000-5a3e-4000-8000-0000000000b4', null),
  ('00000000-5a3e-4000-8000-0000000000ca', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000bb', '00000000-5a3e-4000-8000-0000000000b7', null),
  ('00000000-5a3e-4000-8000-0000000000cb', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000bc', '00000000-5a3e-4000-8000-0000000000b4', null),
  ('00000000-5a3e-4000-8000-0000000000cc', '00000000-5a3e-4000-8000-0000000000a1',
   '00000000-5a3e-4000-8000-0000000000bc', null, '00000000-5a3e-4000-8000-000000000081');

-- ---------------------------------------------------------------------------
-- Independent verification (last: the independence trigger checks all the
-- project records above). Ruth N. has no other role in this project.
-- ---------------------------------------------------------------------------
insert into public.verifications
  (id, assertion_id, verifier_id, independence_declaration,
   independence_declared_on, verified_on, method, finding, notes)
values
  ('00000000-5a3e-4000-8000-0000000000cd', '00000000-5a3e-4000-8000-0000000000b5',
   '00000000-5a3e-4000-8000-0000000000c3',
   'I have no family, financial, or employment tie to Hillside Hope Fellowship or '
   'anyone on this project. (SAMPLE)',
   '2026-07-08', '2026-07-08', 'site_visit', 'confirmed',
   'Visited the site; both rooms roofed with 28-gauge sheets. (SAMPLE)');
