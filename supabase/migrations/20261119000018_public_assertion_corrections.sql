-- Migration 018: show corrections and withdrawals on public passports
-- (backlog item 26b2). Travis, 2026-11-19: withdrawal and correction reasons
-- are public, for transparency. Editors are told on the forms that reasons
-- appear publicly, so they must not contain private details.
--
-- Same view as migration 009 with four columns appended (CREATE OR REPLACE
-- VIEW may only add columns at the end).

create or replace view public.public_assertions
with (security_barrier = true, security_invoker = false) as
select a.id, a.project_id, a.statement, a.status, a.asserted_on,
       case when pe.public_profile then pe.display_name end as asserted_by_name,
       a.corrected_at, a.correction_reason, a.withdrawn_at, a.withdrawal_reason
  from public.assertions a
  join public.projects p on p.id = a.project_id and p.visibility = 'public'
  left join public.people pe on pe.id = a.asserted_by;
