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
