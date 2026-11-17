-- Light Web: upgrade for a database that already has migrations 001-015.
-- Adds migration 016 (sample flag) and tidies the fictional sample project's
-- public text: one "Sample" flag instead of SAMPLE / (fictional) on every line.
-- Paste into the Supabase SQL Editor and click Run once. All-or-nothing:
-- a second run fails harmlessly ("already exists") and changes nothing.
-- Only rows of the fictional sample (ids starting 00000000-5a3e-4000-8000-)
-- are touched; each change is recorded in audit_log.
begin;

-- Migration 016: mark sample projects with a flag (backlog item 23h).
--
-- Until now the fictional sample said "SAMPLE" / "(fictional)" inside its
-- title, organization, suppliers, documents and captions, which cluttered
-- every line. The project now carries one flag instead; pages show a single
-- banner on the passport and a "Sample" tag on its card.
--
-- Public: readers must be able to tell a sample from a real project.

alter table public.projects
  add column is_sample boolean not null default false;

comment on column public.projects.is_sample is
  'True for fictional demonstration projects. Shown publicly as a banner and tag.';

create or replace view public.public_projects
with (security_barrier = true, security_invoker = false) as
select p.id, p.slug, p.title, p.organization_id, p.country, p.region,
       p.need_statement, p.objectives, p.status, p.start_date, p.end_date,
       p.base_currency, p.created_at, p.timezone, p.is_sample
  from public.projects p
 where p.visibility = 'public';

-- ===== sample data tidy-up =====
update public.projects
   set is_sample = true,
       title = replace(title, 'SAMPLE: ', ''),
       region = replace(region, ' (fictional)', ''),
       need_statement = replace(need_statement, 'The fictional Kibira village', 'Kibira village')
 where id::text like '00000000-5a3e-4000-8000-%';

update public.organizations
   set name = replace(name, ' (SAMPLE)', ''),
       region = replace(region, ' (fictional)', ''),
       description = replace(description, 'Fictional local church network used as sample data.',
                             'A local church network serving village congregations.')
 where id::text like '00000000-5a3e-4000-8000-%';

update public.documents
   set title = replace(title, ' (SAMPLE)', '')
 where id::text like '00000000-5a3e-4000-8000-%' and title like '% (SAMPLE)';

update public.suppliers
   set name = replace(replace(name, ' (SAMPLE)', ''), 'Fictional Town Hardware', 'Kibira Town Hardware'),
       region = replace(region, ' (fictional)', '')
 where id::text like '00000000-5a3e-4000-8000-%';

-- Only the public photo; the private one keeps its marker.
update public.evidence_items
   set caption = replace(caption, ' (SAMPLE)', ''),
       location_label = replace(location_label, ' (fictional)', '')
 where id::text like '00000000-5a3e-4000-8000-%' and not shows_identifiable_people;

update public.sustainability_plans
   set local_owner = replace(local_owner, ' (fictional)', '')
 where id::text like '00000000-5a3e-4000-8000-%';

commit;
