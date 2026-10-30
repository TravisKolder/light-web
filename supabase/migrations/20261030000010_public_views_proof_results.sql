-- Migration 006b: public read views — proof, delivery, results, Kingdom Return
-- See docs/data-model.md §3 "Privacy model" and migration 006a for how the
-- public_* views work. Backlog item 8b.
--
-- Rules applied here:
--   * documents: kind, title, date. storage_path only when the document is
--     NOT marked contains_personal_data. Uploader never shown.
--   * verifications: method, finding, dates, tie flag. Verifier name only
--     with a public profile. Free-text notes are NOT shown (may hold
--     personal details).
--   * evidence_items: no GPS; items that show identifiable people are left
--     out entirely.
--   * Author names (reports, Kingdom Return) only with a public profile.
--
-- Run supabase/checks/public_views_no_private_columns.sql after migrating to
-- confirm no PRIVATE column is used by any public_* view.

create view public.public_documents
with (security_barrier = true, security_invoker = false) as
select d.id, a.project_id, d.assertion_id, d.kind, d.title, d.issued_on,
       d.contains_personal_data,
       case when not d.contains_personal_data then d.storage_path end as storage_path
  from public.documents d
  join public.assertions a on a.id = d.assertion_id
  join public.projects p   on p.id = a.project_id and p.visibility = 'public';

create view public.public_verifications
with (security_barrier = true, security_invoker = false) as
select v.id, a.project_id, v.assertion_id,
       case when pe.public_profile then pe.display_name end as verifier_name,
       v.independence_declared_on, v.verified_on, v.method, v.finding,
       v.tie_flagged
  from public.verifications v
  join public.assertions a on a.id = v.assertion_id
  join public.projects p   on p.id = a.project_id and p.visibility = 'public'
  join public.people pe    on pe.id = v.verifier_id;

create view public.public_evidence
with (security_barrier = true, security_invoker = false) as
select e.id, e.project_id, e.assertion_id, e.kind, e.caption, e.captured_on,
       e.location_label, e.storage_path
  from public.evidence_items e
  join public.projects p on p.id = e.project_id and p.visibility = 'public'
 where not e.shows_identifiable_people;

create view public.public_progress_reports
with (security_barrier = true, security_invoker = false) as
select r.id, r.project_id, r.period_start, r.period_end, r.summary,
       r.setbacks, r.assertion_id,
       case when pe.public_profile then pe.display_name end as author_name
  from public.progress_reports r
  join public.projects p on p.id = r.project_id and p.visibility = 'public'
  left join public.people pe on pe.id = r.author_id;

create view public.public_outcomes
with (security_barrier = true, security_invoker = false) as
select o.id, o.project_id, o.description, o.measure, o.target, o.achieved,
       o.assertion_id
  from public.outcomes o
  join public.projects p on p.id = o.project_id and p.visibility = 'public';

create view public.public_lessons
with (security_barrier = true, security_invoker = false) as
select l.id, l.project_id, l.lesson, l.recorded_on
  from public.lessons l
  join public.projects p on p.id = l.project_id and p.visibility = 'public';

create view public.public_sustainability_plans
with (security_barrier = true, security_invoker = false) as
select s.id, s.project_id, s.plan, s.funding_after_grant, s.local_owner,
       s.review_on
  from public.sustainability_plans s
  join public.projects p on p.id = s.project_id and p.visibility = 'public';

create view public.public_kingdom_return_entries
with (security_barrier = true, security_invoker = false) as
select k.id, k.project_id, k.dimension, k.narrative, k.recorded_on,
       case when pe.public_profile then pe.display_name end as author_name
  from public.kingdom_return_entries k
  join public.projects p on p.id = k.project_id and p.visibility = 'public'
  left join public.people pe on pe.id = k.author_id;

-- Links to evidence that is hidden (shows identifiable people) are left out,
-- so the public view never points at a row it can't show.
create view public.public_kingdom_return_links
with (security_barrier = true, security_invoker = false) as
select kl.id, kl.project_id, kl.entry_id, kl.assertion_id, kl.evidence_item_id
  from public.kingdom_return_links kl
  join public.projects p on p.id = kl.project_id and p.visibility = 'public'
  left join public.evidence_items e on e.id = kl.evidence_item_id
 where kl.evidence_item_id is null or not e.shows_identifiable_people;

grant select on
  public.public_documents, public.public_verifications,
  public.public_evidence, public.public_progress_reports,
  public.public_outcomes, public.public_lessons,
  public.public_sustainability_plans,
  public.public_kingdom_return_entries, public.public_kingdom_return_links
to anon, authenticated;
