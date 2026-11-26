-- Fails unless the `evidence` storage bucket (migrations 019-020) is private,
-- capped at 10 MB, limited to PDF/JPEG/PNG/WebP, every write policy is for
-- signed-in editors only, and the ONLY non-editor policy is the read-only
-- evidence_public_view_select (27d3), which must let anon read exactly the
-- files the public views expose on non-sample projects, and nothing else.
-- Run after applying migrations + seed. Makes no lasting changes (rolls back).
-- scripts/check-anon-access.mjs checks the same thing live through the
-- Storage API.
begin;

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

  -- Every policy mentioning the bucket: editors-only, except the one
  -- read-only public-view policy.
  select string_agg(format('%s (%s, roles %s)', policyname, cmd, roles), ', ')
    into bad
    from pg_policies
   where schemaname = 'storage'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%evidence%'
     and not (
       (roles = array['authenticated']::name[]
        and (coalesce(qual, '') || coalesce(with_check, '')) like '%is_editor()%')
       or
       (policyname = 'evidence_public_view_select'
        and cmd = 'SELECT'
        and with_check is null
        and qual like '%public_documents%'
        and qual like '%public_evidence%'
        and qual like '%is_sample%')
     );
  if bad is not null then
    raise exception 'evidence bucket policies not limited to editors / public-view reads: %', bad;
  end if;
end;
$$;

-- Behaviour, using the fictional seed paths: one public document, one
-- personal-data document, one public photo, one photo of identifiable
-- people, and a stray file no record points to.
insert into storage.objects (bucket_id, name) values
  ('evidence', 'sample/board-minutes.pdf'),
  ('evidence', 'sample/bank-statement-feb.pdf'),
  ('evidence', 'sample/roof-complete.jpg'),
  ('evidence', 'sample/first-day.jpg'),
  ('evidence', 'other/not-in-any-record.pdf');

-- 1. Sample project: anon sees nothing.
set local role anon;
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'evidence') then
    raise exception 'anon can read evidence files of a SAMPLE project';
  end if;
end;
$$;
reset role;

-- 2. Same project treated as real: anon sees only the two public files.
update public.projects set is_sample = false where id = '00000000-5a3e-4000-8000-0000000000a1';
set local role anon;
do $$
declare seen text;
begin
  select string_agg(name, ', ' order by name) into seen
    from storage.objects
   where bucket_id = 'evidence'
     and name in ('sample/bank-statement-feb.pdf', 'sample/first-day.jpg', 'other/not-in-any-record.pdf');
  if seen is not null then raise exception 'anon can read private evidence files: %', seen; end if;
  if (select count(*) from storage.objects
       where name in ('sample/board-minutes.pdf', 'sample/roof-complete.jpg')) <> 2 then
    raise exception 'anon cannot read the files the public views expose';
  end if;
end;
$$;

-- 3. Anon can never write.
do $$
begin
  begin
    insert into storage.objects (bucket_id, name) values ('evidence', 'anon/probe.pdf');
    raise exception 'anon could upload to the evidence bucket';
  exception when insufficient_privilege then null;
  end;
  update storage.objects set name = name || '.x' where bucket_id = 'evidence';
  if found then raise exception 'anon could rename evidence files'; end if;
  delete from storage.objects where bucket_id = 'evidence';
  if found then raise exception 'anon could delete evidence files'; end if;
end;
$$;
reset role;

do $$ begin raise notice 'OK: evidence bucket private, capped, type-limited; editors write; anon reads only public-view files'; end; $$;
rollback;
