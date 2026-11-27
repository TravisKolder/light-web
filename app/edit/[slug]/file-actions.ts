"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { EVIDENCE_BUCKET, prepareUpload, randomStoragePath } from "@/lib/uploads";

// Replace or remove the file attached to a document or evidence item
// (backlog item 27e). Only the row's storage_path changes; its title,
// caption, flags and the statement's status are left alone. The audit_log
// trigger records the old and new path (so History shows the change), and
// the old object is then deleted from the private `evidence` bucket.
//
// Order matters so a failure never leaves a row pointing at nothing:
//   replace: upload new → update row → delete old (if the row update fails,
//            the new upload is deleted instead).
//   remove:  update row to null → delete old.
// If deleting the old object fails, the row is already correct and the
// leftover object is unreachable from any page; it is logged for cleanup.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLES = { documents: "documents", evidence: "evidence_items" } as const;
type Kind = keyof typeof TABLES;

export async function changeFile(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const kind = get("kind");
  const id = get("id");
  const op = get("op");
  const back = (q: string): never =>
    redirect(`/edit/${encodeURIComponent(slug)}?${q}&fileId=${encodeURIComponent(id)}#f-${encodeURIComponent(id)}`);
  const fail = (code: string): never => back(`fileError=${code}`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");
  if (!UUID.test(projectId) || !UUID.test(id) || !(kind in TABLES)) fail("row");
  if (op !== "replace" && op !== "remove") fail("op");
  const table = TABLES[kind as Kind];

  const supabase = (await getSupabaseServerClient())!;
  // Confirm the row belongs to this project (documents reach it through
  // their statement; evidence items carry project_id themselves).
  const { data: row } =
    table === "documents"
      ? await supabase
          .from("documents")
          .select("storage_path, assertion:assertions!inner(project_id)")
          .eq("id", id)
          .eq("assertion.project_id", projectId)
          .maybeSingle<{ storage_path: string | null }>()
      : await supabase
          .from("evidence_items")
          .select("storage_path")
          .eq("id", id)
          .eq("project_id", projectId)
          .maybeSingle<{ storage_path: string | null }>();
  if (!row) fail("row");
  const oldPath = row!.storage_path;

  let newPath: string | null = null;
  if (op === "remove") {
    if (!oldPath) fail("noFile");
    if (get("confirm") !== "yes") fail("confirm");
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) fail("noUpload");
    const prepared = await prepareUpload(file as File);
    if (!prepared.ok) fail(prepared.error);
    if (prepared.ok) {
      newPath = randomStoragePath(kind as Kind, prepared.ext);
      const { error: upErr } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(newPath, prepared.bytes, { contentType: prepared.contentType, upsert: false });
      if (upErr) {
        console.error("changeFile upload failed:", upErr.message);
        fail("fileUpload");
      }
    }
  }

  const { error } = await supabase.from(table).update({ storage_path: newPath }).eq("id", id);
  if (error) {
    console.error("changeFile update failed:", error.message);
    if (newPath) await supabase.storage.from(EVIDENCE_BUCKET).remove([newPath]);
    fail("save");
  }

  if (oldPath) {
    const { error: rmErr } = await supabase.storage.from(EVIDENCE_BUCKET).remove([oldPath]);
    if (rmErr) console.error(`changeFile: old file left in storage (${table} ${id}):`, rmErr.message);
  }

  revalidatePath(`/edit/${slug}`);
  revalidatePath(`/p/${slug}`);
  back(op === "remove" ? "fileRemoved=1" : "fileReplaced=1");
}
