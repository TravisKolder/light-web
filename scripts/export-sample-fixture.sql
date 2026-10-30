-- Exports the sample project's PUBLIC data to JSON, reading only the
-- public_* views as the anon role, so nothing private can end up in the
-- fixture. Used to regenerate lib/sample/passport.json after changing
-- supabase/seed.sql:
--
--   psql "$DATABASE_URL" -At -f scripts/export-sample-fixture.sql > lib/sample/passport.json
--
set role anon;
with p as (select * from public_projects where slug = 'sample-kibira-classroom-block')
select jsonb_pretty(jsonb_build_object(
  '_note', 'SAMPLE DATA - entirely fictional. Generated from public_* views by scripts/export-sample-fixture.sql.',
  'project', (select to_jsonb(p) from p),
  'organization', (select to_jsonb(o) from public_organizations o join p on p.organization_id = o.id),
  'leaders', coalesce((select jsonb_agg(to_jsonb(x) order by x.role) from public_project_leaders x join p on p.id = x.project_id), '[]'),
  'assertions', coalesce((select jsonb_agg(to_jsonb(x) order by x.asserted_on, x.id) from public_assertions x join p on p.id = x.project_id), '[]'),
  'budgetLines', coalesce((select jsonb_agg(to_jsonb(x) order by x.category) from public_budget_lines x join p on p.id = x.project_id), '[]'),
  'budgetVsActual', coalesce((select jsonb_agg(to_jsonb(x) order by x.category) from public_budget_vs_actual x join p on p.id = x.project_id), '[]'),
  'fundsReceived', coalesce((select jsonb_agg(to_jsonb(x) order by x.received_on) from public_funds_received x join p on p.id = x.project_id), '[]'),
  'purchases', coalesce((select jsonb_agg(to_jsonb(x) order by x.purchased_on) from public_purchases x join p on p.id = x.project_id), '[]'),
  'payments', coalesce((select jsonb_agg(to_jsonb(x) order by x.paid_on) from public_payments x join p on p.id = x.project_id), '[]'),
  'documents', coalesce((select jsonb_agg(to_jsonb(x) order by x.issued_on) from public_documents x join p on p.id = x.project_id), '[]'),
  'verifications', coalesce((select jsonb_agg(to_jsonb(x) order by x.verified_on) from public_verifications x join p on p.id = x.project_id), '[]'),
  'evidence', coalesce((select jsonb_agg(to_jsonb(x) order by x.captured_on) from public_evidence x join p on p.id = x.project_id), '[]'),
  'progressReports', coalesce((select jsonb_agg(to_jsonb(x) order by x.period_start) from public_progress_reports x join p on p.id = x.project_id), '[]'),
  'outcomes', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public_outcomes x join p on p.id = x.project_id), '[]'),
  'lessons', coalesce((select jsonb_agg(to_jsonb(x) order by x.recorded_on) from public_lessons x join p on p.id = x.project_id), '[]'),
  'sustainabilityPlans', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public_sustainability_plans x join p on p.id = x.project_id), '[]'),
  'kingdomReturnEntries', coalesce((select jsonb_agg(to_jsonb(x) order by x.dimension) from public_kingdom_return_entries x join p on p.id = x.project_id), '[]'),
  'kingdomReturnLinks', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public_kingdom_return_links x join p on p.id = x.project_id), '[]')
));
