-- Migration 013: explicit API grants (added 2026-11-12 while setting up the
-- first real Supabase project).
--
-- Earlier migrations relied on Supabase's default privileges for base tables.
-- Newer Supabase projects may not grant table access to the API roles
-- automatically, so this makes the intended access explicit:
--
-- * anon (signed-out visitors): NO access to base tables at all. They read
--   only the public_* views (granted in migrations 009 and 010).
-- * authenticated (signed-in users): table privileges on base tables, but RLS
--   still limits every row to people on public.editors (migration 012).
--   Signed-in non-editors therefore see nothing.
-- * public.editors: readable (RLS: editors only), never writable via the API.

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'people', 'projects', 'project_leaders',
    'assertions', 'documents', 'verifications',
    'budget_lines', 'funds_received', 'suppliers', 'purchases', 'payments',
    'evidence_items', 'progress_reports', 'outcomes', 'lessons',
    'sustainability_plans', 'kingdom_return_entries', 'kingdom_return_links'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

revoke all on public.editors from anon;
revoke insert, update, delete, truncate on public.editors from authenticated;
grant select on public.editors to authenticated;
