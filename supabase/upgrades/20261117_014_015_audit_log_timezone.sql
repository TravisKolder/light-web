-- Light Web: upgrade for a database that was set up BEFORE 2026-11-17
-- (i.e. loaded with light-web-setup.sql up to migration 013).
-- Adds migration 014 (append-only audit log) and 015 (project time zone).
-- Paste into the Supabase SQL Editor and click Run once. All-or-nothing:
-- running it a second time fails harmlessly ("already exists") and changes nothing.
begin;

-- ===== supabase/migrations/20261117000014_audit_log.sql =====
-- Migration 014: append-only audit log (backlog item 22c, site review S3).
--
-- Every insert, update and delete on every Passport table (and on
-- public.editors) writes one row here: who, when, which table and row, the
-- old values and the new values. For an accountability tool, silent edits to
-- history are the main abuse case; this makes every edit leave a trail.
--
-- * Written only by triggers. Nobody can insert, update or delete through the
--   API, and a guard trigger refuses UPDATE / DELETE / TRUNCATE for every
--   role, including in the SQL editor.
-- * Readable by editors only. old_row / new_row hold whole rows, PRIVATE
--   columns included, so this table must never feed a public_* view.
-- * actor_id is the signed-in Supabase user (auth.uid()); it is null for
--   changes made in the SQL editor or by migrations, where actor_role shows
--   the database role instead.
-- * Status changes made by the status trigger are logged too (as an UPDATE of
--   assertions by whoever caused them), so the claim -> documented -> verified
--   history of every statement can be reconstructed.

create table public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,
  actor_role   text not null,
  table_name   text not null,
  action       text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  row_id       text,
  project_id   uuid,
  old_row      jsonb,
  new_row      jsonb,
  constraint audit_rows_match_action check (
    (action = 'INSERT' and old_row is null     and new_row is not null) or
    (action = 'UPDATE' and old_row is not null and new_row is not null) or
    (action = 'DELETE' and old_row is not null and new_row is null)
  )
);

comment on table public.audit_log is
  'Append-only change history. Editors read; nobody writes except triggers. Contains PRIVATE data.';
comment on column public.audit_log.old_row is 'PRIVATE';
comment on column public.audit_log.new_row is 'PRIVATE';
comment on column public.audit_log.actor_id is 'PRIVATE';

create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index audit_log_project_idx   on public.audit_log (project_id, occurred_at);
create index audit_log_actor_idx     on public.audit_log (actor_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Recording trigger. security definer so it can write the log whatever the
-- caller's own rights are; empty search_path to avoid hijacking.
-- ---------------------------------------------------------------------------
create function public.record_audit()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
begin
  -- An UPDATE that changed nothing is not history.
  if tg_op = 'UPDATE' and o = n then
    return null;
  end if;

  insert into public.audit_log
    (actor_id, actor_role, table_name, action, row_id, project_id, old_row, new_row)
  values (
    auth.uid(),
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
             nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
             session_user),
    tg_table_name,
    tg_op,
    -- Most tables have an id; editors is keyed by user_id; project_leaders
    -- by (project, person, role).
    coalesce(r ->> 'id', r ->> 'user_id',
             concat_ws('/', r ->> 'project_id', r ->> 'person_id', r ->> 'role')),
    case when tg_table_name = 'projects' then (r ->> 'id')::uuid
         else (r ->> 'project_id')::uuid end,
    o, n
  );
  return null;
end;
$$;

revoke all on function public.record_audit() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'people', 'projects', 'project_leaders',
    'assertions', 'documents', 'verifications',
    'budget_lines', 'funds_received', 'suppliers', 'purchases', 'payments',
    'evidence_items', 'progress_reports', 'outcomes', 'lessons',
    'sustainability_plans', 'kingdom_return_entries', 'kingdom_return_links',
    'editors'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.record_audit()',
      'zz_audit_' || t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Append-only guard: no role may change or remove history.
-- ---------------------------------------------------------------------------
create function public.audit_log_is_append_only()
returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only: % is not allowed', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.audit_log_is_append_only() from public, anon, authenticated;

create trigger audit_log_no_change
  before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_is_append_only();

-- ---------------------------------------------------------------------------
-- Access: editors read, nobody writes through the API, anon gets nothing.
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy audit_log_editors_read on public.audit_log
  for select to authenticated using (public.is_editor());

-- ===== supabase/migrations/20261117000015_project_timezone.sql =====
-- Migration 015: project time zone (backlog item 22d, site review S7).
--
-- Dates in a Passport (date stated, date issued, date captured, ...) are
-- calendar dates in the project's own local time. Until now "today" came from
-- the server clock (UTC), so a statement entered in the US evening was dated
-- the next day. Each project now names its time zone; the editor forms use it
-- for "today" and for the not-in-the-future check, and Passport pages say
-- which time zone the dates are in.
--
-- The time zone is public (it is implied by country/region anyway).

create function public.is_valid_timezone(tz text)
returns boolean
language plpgsql stable set search_path = '' as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.is_valid_timezone(text) from public, anon;
grant execute on function public.is_valid_timezone(text) to authenticated;

alter table public.projects
  add column timezone text not null default 'UTC'
  constraint projects_timezone_valid check (public.is_valid_timezone(timezone));

comment on column public.projects.timezone is
  'IANA time zone name (e.g. Africa/Kampala). Dates recorded for the project are local dates in this zone.';

-- Today's date where the project is.
create function public.project_today(p_project_id uuid)
returns date
language sql stable set search_path = '' as $$
  select (now() at time zone p.timezone)::date
    from public.projects p where p.id = p_project_id;
$$;

revoke all on function public.project_today(uuid) from public, anon;
grant execute on function public.project_today(uuid) to authenticated;

-- New statements default to the project's local date, not the server's.
create function public.assertions_default_asserted_on()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.asserted_on is null then
    new.asserted_on := coalesce(public.project_today(new.project_id), current_date);
  end if;
  return new;
end;
$$;

revoke all on function public.assertions_default_asserted_on() from public, anon, authenticated;

alter table public.assertions alter column asserted_on drop default;

create trigger assertions_default_asserted_on
  before insert on public.assertions
  for each row execute function public.assertions_default_asserted_on();

-- Expose the time zone on the public view (new column goes last so the view
-- can be replaced in place).
create or replace view public.public_projects
with (security_barrier = true, security_invoker = false) as
select p.id, p.slug, p.title, p.organization_id, p.country, p.region,
       p.need_statement, p.objectives, p.status, p.start_date, p.end_date,
       p.base_currency, p.created_at, p.timezone
  from public.projects p
 where p.visibility = 'public';

-- ===== sample data: the fictional Kibira project is in Uganda =====
update public.projects set timezone = 'Africa/Kampala'
 where slug = 'sample-kibira-classroom-block';

commit;
