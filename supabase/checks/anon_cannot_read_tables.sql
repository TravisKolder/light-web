-- Fails if the anon role (signed-out visitors) has any privilege on any base
-- table in schema public, or if any such table has row level security off.
-- Run after applying migrations. Complements scripts/check-anon-access.mjs,
-- which checks the same thing against a live project through the API.
do $$
declare
  bad text;
begin
  select string_agg(format('%s (%s)', c.relname, p.privs), E'\n' order by c.relname)
    into bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    cross join lateral (
      select string_agg(priv, ', ') as privs
        from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) priv
       where has_table_privilege('anon', c.oid, priv)
    ) p
   where c.relkind = 'r' and p.privs is not null;
  if bad is not null then
    raise exception E'anon has privileges on base tables:\n%', bad;
  end if;

  select string_agg(c.relname, ', ' order by c.relname)
    into bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where c.relkind = 'r' and not c.relrowsecurity;
  if bad is not null then
    raise exception 'row level security is off on: %', bad;
  end if;

  raise notice 'OK: anon has no privileges on any base table, and RLS is on everywhere';
end;
$$;
