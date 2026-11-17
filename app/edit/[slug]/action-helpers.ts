import { todayInTimeZone } from "@/lib/format";
import { redirect } from "next/navigation";
import { UUID } from "@/lib/edit-validation";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";

// Helpers shared by the editor's money actions. Plain module (not
// "use server"): these are called by server actions, never by the browser.

export type Supabase = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;

export async function loadProject(supabase: Supabase, projectId: string) {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle<{ id: string; base_currency: string; timezone?: string }>();
  return data ? { base: data.base_currency, today: todayInTimeZone(data.timezone) } : null;
}

// The linked statement must belong to this project (the composite foreign
// key enforces it too; checking first gives a plain-language error).
export async function statementInProject(supabase: Supabase, assertionId: string, projectId: string) {
  const { data } = await supabase
    .from("assertions").select("id").eq("id", assertionId).eq("project_id", projectId).maybeSingle();
  return Boolean(data);
}

// The database has its own currency rule; if it still refuses, say why.
export function currencyError(message: string): string | null {
  if (/Same currency as project base/.test(message)) return "rateNotNeeded";
  if (/differs from project base/.test(message)) return "rateSource";
  return null;
}

export function moneyFields(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  return { currency: get("currency"), rate: get("exchange_rate"), rateDate: get("rate_date"), rateSource: get("rate_source") };
}

/**
 * Common start of every editor action: read the form, re-check that the
 * caller is a signed-in editor, and load the project (currency and local
 * date) from the database. `back(code)` returns to the page with an error or
 * success code; it never returns.
 */
export async function beginEdit(
  formData: FormData,
  opts: { page: string; anchor: string; errorKey: string },
) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const to = (query: string): never =>
    redirect(`/edit/${encodeURIComponent(slug)}/${opts.page}?${query}#${opts.anchor}`);
  const back = (code: string): never => to(`${opts.errorKey}=${code}`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");
  if (!UUID.test(projectId)) back("project");

  const supabase = (await getSupabaseServerClient())!;
  const project = await loadProject(supabase, projectId);
  if (!project) back("project");

  return { get, slug, projectId, supabase, today: project!.today, base: project!.base, back, to };
}
