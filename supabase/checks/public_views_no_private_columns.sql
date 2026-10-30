-- Privacy check: fails if any public_* view reads a column whose comment is
-- exactly 'PRIVATE'. Run after applying migrations, e.g.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/public_views_no_private_columns.sql
--
-- Columns that are only conditionally private (e.g. documents.storage_path,
-- people.display_name) are not tagged plain 'PRIVATE'; their views must gate
-- them with CASE / WHERE, which is checked by review and by the item 17 test.

do $$
declare
  leaks text;
begin
  select string_agg(format('%s uses %s.%s', vcu.view_name, vcu.table_name, vcu.column_name),
                    E'\n' order by vcu.view_name, vcu.table_name, vcu.column_name)
    into leaks
    from information_schema.view_column_usage vcu
    join pg_catalog.pg_class c
      on c.relname = vcu.table_name
     and c.relnamespace = 'public'::regnamespace
    join pg_catalog.pg_attribute att
      on att.attrelid = c.oid and att.attname = vcu.column_name
   where vcu.view_schema = 'public'
     and vcu.view_name like 'public\_%'
     and col_description(c.oid, att.attnum) = 'PRIVATE';

  if leaks is not null then
    raise exception E'PRIVATE columns used by public views:\n%', leaks;
  end if;

  raise notice 'OK: no PRIVATE column is used by any public_* view';
end;
$$;
