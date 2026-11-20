-- Light Web: upgrade for a database that already has migrations 001-018.
-- Adds migration 019 (private `evidence` storage bucket + editor-only
-- storage policies, item 27a).
-- Paste into the Supabase SQL Editor and click Run once. Safe to re-run.
begin;

-- Migration 019: private storage bucket for document and evidence files
-- (backlog item 27a). Travis approved file uploads on 2026-11-19.
--
-- * One private bucket, `evidence`. Not public: there is no public URL for
--   any file in it. Size cap and allowed types are set on the bucket, so
--   Supabase Storage refuses anything else before it is stored. The app's
--   own server-side checks (27b/27c: real type from the file's first bytes,
--   EXIF/GPS stripping) come on top of this, not instead of it.
-- * Only editors (public.editors, via is_editor()) may upload, read, replace
--   or delete objects in the bucket. Anon and signed-in non-editors get no
--   policy, so storage RLS gives them nothing (not even a listing).
-- * The public passport will only ever get a short-lived signed URL made by
--   a server route that re-checks the public views first (27d).
-- * Files are evidence, not payments: nothing here moves or solicits money.
-- * Changes nothing in Supabase project settings; it only inserts a bucket
--   row and adds policies on storage.objects, like the dashboard would.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evidence_editors_select on storage.objects;
drop policy if exists evidence_editors_insert on storage.objects;
drop policy if exists evidence_editors_update on storage.objects;
drop policy if exists evidence_editors_delete on storage.objects;

create policy evidence_editors_select on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and public.is_editor());

create policy evidence_editors_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and public.is_editor());

create policy evidence_editors_update on storage.objects
  for update to authenticated
  using (bucket_id = 'evidence' and public.is_editor())
  with check (bucket_id = 'evidence' and public.is_editor());

create policy evidence_editors_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and public.is_editor());

commit;
