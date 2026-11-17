"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  FUNDS_SOURCES, UUID, isValidDate, parseAmount, resolveMoney,
} from "@/lib/edit-validation";
import { todayInTimeZone } from "@/lib/format";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";

// Server actions for the ledger forms, part 1 (backlog item 21d): budget
// lines and funds received. Money is only RECORDED here; nothing is moved or
// collected. Every action re-checks editor access, validates every field,
// reads the project's currency and date from the database (never the form),
// and never sets a status.

const MAX_CATEGORY = 80;
const MAX_TEXT = 500;
const MAX_DONOR = 200;

type Supabase = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;

async function loadProject(supabase: Supabase, projectId: string) {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle<{ id: string; base_currency: string; timezone?: string }>();
  return data ? { base: data.base_currency, today: todayInTimeZone(data.timezone) } : null;
}

// The linked statement must belong to this project (the composite foreign
// key enforces it too; checking first gives a plain-language error).
async function statementInProject(supabase: Supabase, assertionId: string, projectId: string) {
  const { data } = await supabase
    .from("assertions").select("id").eq("id", assertionId).eq("project_id", projectId).maybeSingle();
  return Boolean(data);
}

// The database has its own currency rule; if it still refuses, say why.
function currencyError(message: string): string | null {
  if (/Same currency as project base/.test(message)) return "rateNotNeeded";
  if (/differs from project base/.test(message)) return "rateSource";
  return null;
}

function moneyFields(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  return { currency: get("currency"), rate: get("exchange_rate"), rateDate: get("rate_date"), rateSource: get("rate_source") };
}

export async function addBudgetLine(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const category = get("category");
  const description = get("description");
  const approvedOn = get("approved_on");
  const assertionId = get("assertion_id");
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}/ledger?${q}#add-budget`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("budgetError=project");
  if (category.length === 0) back("budgetError=category");
  if (category.length > MAX_CATEGORY || description.length > MAX_TEXT) back("budgetError=long");
  const amount = parseAmount(get("approved_amount"));
  if (!amount) back("budgetError=amount");
  if (approvedOn && !isValidDate(approvedOn)) back("budgetError=date");
  if (assertionId && !UUID.test(assertionId)) back("budgetError=assertion");

  const supabase = (await getSupabaseServerClient())!;
  const project = await loadProject(supabase, projectId);
  if (!project) back("budgetError=project");
  const { base, today } = project!;
  if (approvedOn > today) back("budgetError=future");

  const money = resolveMoney(moneyFields(formData), base, approvedOn || today, today);
  if (!money.ok) back(`budgetError=${money.error}`);
  if (assertionId && !(await statementInProject(supabase, assertionId, projectId))) back("budgetError=assertion");

  const m = money as Extract<typeof money, { ok: true }>;
  const { error } = await supabase.from("budget_lines").insert({
    project_id: projectId,
    category,
    description: description || null,
    approved_amount: amount,
    currency: m.currency,
    exchange_rate: m.exchange_rate,
    rate_date: m.rate_date,
    rate_source: m.rate_source,
    approved_on: approvedOn || null,
    assertion_id: assertionId || null,
  });
  if (error) {
    console.error("addBudgetLine failed:", error.message);
    back(`budgetError=${currencyError(error.message) ?? "save"}`);
  }

  revalidatePath(`/edit/${slug}/ledger`);
  back("budgetAdded=1");
}

export async function addFundsReceived(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const receivedOn = get("received_on");
  const source = get("source_category");
  const assertionId = get("assertion_id");
  const donorPersonId = get("donor_person_id");
  const donorName = get("donor_name");
  const donorContact = get("donor_contact");
  const donorReference = get("donor_reference");
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}/ledger?${q}#add-funds`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("fundsError=project");
  const amount = parseAmount(get("amount"));
  if (!amount || Number(amount) <= 0) back("fundsError=amount");
  if (!isValidDate(receivedOn)) back("fundsError=date");
  if (!(FUNDS_SOURCES as readonly string[]).includes(source)) back("fundsError=source");
  if (assertionId && !UUID.test(assertionId)) back("fundsError=assertion");
  if (donorPersonId && !UUID.test(donorPersonId)) back("fundsError=person");
  if ([donorName, donorContact, donorReference].some((v) => v.length > MAX_DONOR)) back("fundsError=long");

  const supabase = (await getSupabaseServerClient())!;
  const project = await loadProject(supabase, projectId);
  if (!project) back("fundsError=project");
  const { base, today } = project!;
  if (receivedOn > today) back("fundsError=future");

  const money = resolveMoney(moneyFields(formData), base, receivedOn, today);
  if (!money.ok) back(`fundsError=${money.error}`);
  if (assertionId && !(await statementInProject(supabase, assertionId, projectId))) back("fundsError=assertion");

  const m = money as Extract<typeof money, { ok: true }>;
  const { error } = await supabase.from("funds_received").insert({
    project_id: projectId,
    amount,
    currency: m.currency,
    exchange_rate: m.exchange_rate,
    rate_date: m.rate_date,
    rate_source: m.rate_source,
    received_on: receivedOn,
    source_category: source,
    assertion_id: assertionId || null,
    // PRIVATE: never shown on public pages.
    donor_person_id: donorPersonId || null,
    donor_name: donorName || null,
    donor_contact: donorContact || null,
    donor_reference: donorReference || null,
  });
  if (error) {
    console.error("addFundsReceived failed:", error.message);
    back(`fundsError=${currencyError(error.message) ?? "save"}`);
  }

  revalidatePath(`/edit/${slug}/ledger`);
  back("fundsAdded=1");
}
