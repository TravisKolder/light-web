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
