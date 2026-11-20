-- Fails unless the `evidence` storage bucket (migration 019) is private,
-- capped at 10 MB, limited to PDF/JPEG/PNG/WebP, and every storage policy
-- that mentions it is for signed-in editors only (none for anon or public).
-- Run after applying migrations. scripts/check-anon-access.mjs checks the
-- same thing live through the Storage API.
do $$
declare
  b record;
  bad text;
begin
  select * into b from storage.buckets where id = 'evidence';
  if not found then raise exception 'bucket "evidence" is missing'; end if;
  if b.public is distinct from false then raise exception 'bucket "evidence" is public'; end if;
  if b.file_size_limit is null or b.file_size_limit > 10485760 then
    raise exception 'bucket "evidence" size limit is % (want <= 10 MB)', b.file_size_limit;
  end if;
  if b.allowed_mime_types is null
     or not (b.allowed_mime_types <@ array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) then
    raise exception 'bucket "evidence" allows types %', b.allowed_mime_types;
  end if;

  select string_agg(format('%s (roles %s)', policyname, roles), ', ')
    into bad
    from pg_policies
   where schemaname = 'storage'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%evidence%'
     and (roles <> array['authenticated']::name[]
          or (coalesce(qual, '') || coalesce(with_check, '')) not like '%is_editor()%');
  if bad is not null then
    raise exception 'evidence bucket policies not limited to editors: %', bad;
  end if;

  raise notice 'OK: evidence bucket is private, capped, type-limited, editors only';
end;
$$;
