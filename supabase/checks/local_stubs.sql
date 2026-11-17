-- Minimal stand-ins for what Supabase provides (API roles, auth.users,
-- auth.uid()), so the migrations can be applied to a plain Postgres for
-- testing (CI, or locally). Never run this on a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
