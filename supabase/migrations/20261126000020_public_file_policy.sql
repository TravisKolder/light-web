-- Migration 020: public files without a service key (backlog item 27d3).
-- Travis, 2026-11-24: "Protecting private data matters more than
-- convenience." So the app holds no service_role key; instead anon (and any
-- signed-in user) may READ exactly the objects in the `evidence` bucket that
-- the public views already expose, and nothing else.
--
-- * SELECT only. Upload, replace and delete stay editors-only (migration 019).
-- * An object qualifies only if its name is a non-null storage_path in
--   public_documents (already null when contains_personal_data) or
--   public_evidence (already drops photos of identifiable people), on a
--   public project that is not sample data. Hide a row in the views (mark a
--   document as personal data, flag identifiable people, make the project
--   private) and its file becomes unreadable to anon at once.
-- * The bucket stays private: no public URLs. The public route still signs a
--   60-second URL server-side and streams the file, so neither path nor URL
--   reaches the browser.
-- * The views run with their owner's rights (security_invoker = false), so
--   this policy can consult them without giving anon any base table.
-- * Changes nothing in Supabase project settings.

drop policy if exists evidence_public_view_select on storage.objects;

create policy evidence_public_view_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'evidence'
    and name in (
      select d.storage_path
        from public.public_documents d
        join public.public_projects p on p.id = d.project_id and not p.is_sample
       where d.storage_path is not null
      union
      select e.storage_path
        from public.public_evidence e
        join public.public_projects p on p.id = e.project_id and not p.is_sample
       where e.storage_path is not null
    )
  );

comment on policy evidence_public_view_select on storage.objects is
  'Read-only: only files the public views expose (27d3). Writes stay editors-only.';
