"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";

// Server action for adding an assertion (backlog item 21b).
// The form never sends a status: every new assertion starts as a claim, and
// only the database triggers can move it to documented or verified.

// Keep in sync with maxLength on the form in page.tsx ("use server" files
// may only export async functions).
const MAX_STATEMENT_LENGTH = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export async function addAssertion(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const statement = String(formData.get("statement") ?? "").trim();
  const assertedBy = String(formData.get("asserted_by") ?? "").trim();
  const assertedOn = String(formData.get("asserted_on") ?? "").trim();
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}?${q}#add`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("error=project");
  if (statement.length === 0) back("error=statement");
  if (statement.length > MAX_STATEMENT_LENGTH) back("error=long");
  if (assertedBy && !UUID.test(assertedBy)) back("error=person");
  if (assertedOn) {
    if (!isValidDate(assertedOn)) back("error=date");
    if (assertedOn > new Date().toISOString().slice(0, 10)) back("error=future");
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase!.from("assertions").insert({
    project_id: projectId,
    statement,
    asserted_by: assertedBy || null,
    // Omitted → the database default (today).
    ...(assertedOn ? { asserted_on: assertedOn } : {}),
  });
  if (error) {
    console.error("addAssertion failed:", error.message);
    back("error=save");
  }

  revalidatePath(`/edit/${slug}`);
  back("added=1");
}
