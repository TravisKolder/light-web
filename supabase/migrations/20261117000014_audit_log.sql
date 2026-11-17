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
