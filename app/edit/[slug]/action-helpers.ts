import { todayInTimeZone } from "@/lib/format";
import type { getSupabaseServerClient } from "@/lib/supabase/server";

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
