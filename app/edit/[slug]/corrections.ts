"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";

// Server actions for correcting or withdrawing a statement (backlog item
// 26b1). The database (migration 017) enforces the same rules and sets the
// corrected/withdrawn timestamps; old and new values land in audit_log, so
// every change shows on the project's History page. Neither action touches
// the claim / documented / verified status.

// Keep in sync with maxLength on the forms in page.tsx.
const MAX_STATEMENT_LENGTH = 2000;
const MAX_REASON_LENGTH = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function begin(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const assertionId = get("assertion_id");
  const back = (q: string): never =>
    redirect(`/edit/${encodeURIComponent(slug)}?${q}#s-${encodeURIComponent(assertionId)}`);
  const fail = (code: string): never => back(`corrError=${code}&corrId=${encodeURIComponent(assertionId)}`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");
  if (!UUID.test(projectId) || !UUID.test(assertionId)) fail("statementId");

  const supabase = (await getSupabaseServerClient())!;
  const { data: current } = await supabase
    .from("assertions")
    .select("*")
    .eq("id", assertionId)
    .eq("project_id", projectId)
    .maybeSingle<{ statement: string; correction_reason?: string | null; withdrawn_at?: string | null }>();
  if (!current) fail("statementId");
  if (current!.withdrawn_at) fail("withdrawn");

  const reason = get("reason");
  if (reason.length === 0) fail("reason");
  if (reason.length > MAX_REASON_LENGTH) fail("reasonLong");

  return { get, slug, assertionId, supabase, current: current!, reason, back, fail };
}

function dbError(message: string, hint: string | undefined | null) {
  if (hint === "withdrawn") return "withdrawn";
  if (hint === "reason") return "sameReason";
  console.error("statement correction failed:", message);
  return "save";
}

export async function correctAssertion(formData: FormData) {
  const { get, slug, assertionId, supabase, current, reason, back, fail } = await begin(formData);
  const statement = get("statement");
  if (statement.length === 0) fail("statement");
  if (statement.length > MAX_STATEMENT_LENGTH) fail("long");
  if (statement === current.statement) fail("unchanged");
  if (reason === (current.correction_reason ?? "")) fail("sameReason");

  const { error } = await supabase
    .from("assertions")
    .update({ statement, correction_reason: reason })
    .eq("id", assertionId);
  if (error) fail(dbError(error.message, error.hint));

  revalidatePath(`/edit/${slug}`);
  back("corrected=1");
}

export async function withdrawAssertion(formData: FormData) {
  const { slug, assertionId, supabase, reason, back, fail } = await begin(formData);
  if (String(formData.get("confirm") ?? "") !== "yes") fail("confirm");

  const { error } = await supabase
    .from("assertions")
    .update({ withdrawal_reason: reason })
    .eq("id", assertionId);
  if (error) fail(dbError(error.message, error.hint));

  revalidatePath(`/edit/${slug}`);
  back("withdrawn=1");
}
