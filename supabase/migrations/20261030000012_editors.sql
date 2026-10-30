-- Migration 008: editor access (pilot version)
-- Backlog item 11b. Decided by Travis, 2026-10-30: for the pilot only Travis
-- and John edit; widen to ministry staff later.
--
-- * public.editors lists Supabase Auth users who may read and write every
--   Passport table. Rows are added by hand in the SQL editor (see README);
--   there is no API path to make yourself an editor.
-- * Everyone else (anon, and signed-in users who aren't editors) still sees
--   only the public_* views.
-- * Later: add organization_id + role to editors (or a separate
--   organization_members table) and scope the policies per organization.
--
-- All the integrity triggers (status derivation, verifier independence,
-- currency rule) still apply to editors.

create table public.editors (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  added_on      date not null default current_date
);

alter table public.editors enable row level security;

-- security definer so the check can read editors regardless of the caller's
-- own RLS; empty search_path to avoid hijacking.
create function public.is_editor()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.editors e where e.user_id = auth.uid());
$$;

revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated;

-- Editors can see who the editors are; nobody can change the list via the API.
create policy editors_read on public.editors
  for select to authenticated using (public.is_editor());

-- Full read/write for editors on every Passport base table.
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
    execute format(
      'create policy editors_all on public.%I for all to authenticated
         using (public.is_editor()) with check (public.is_editor())', t);
  end loop;
end;
$$;
