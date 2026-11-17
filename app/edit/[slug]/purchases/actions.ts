"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UUID, isValidDate, parseAmount, resolveMoney } from "@/lib/edit-validation";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { currencyError, loadProject, moneyFields, statementInProject } from "../action-helpers";

// Server actions for the ledger forms, part 2 (backlog item 21e): purchases
// and the payments made for them. Money is only RECORDED here; nothing is
// paid or moved. Every action re-checks editor access, validates every field,
// reads the project's currency and date from the database, confirms linked
// rows belong to this project, and never sets a status.

const MAX_TEXT = 300;
const MAX_UNIT = 40;
const MAX_NAME = 200;
const PAYMENT_METHODS = ["bank_transfer", "mobile_money", "cash", "check"] as const;

export async function addPurchase(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const budgetLineId = get("budget_line_id");
  const supplierId = get("supplier_id");
  const newSupplier = get("new_supplier_name");
  const description = get("description");
  const quantityRaw = get("quantity").replace(/[,\s]/g, "");
  const unit = get("unit");
  const purchasedOn = get("purchased_on");
  const assertionId = get("assertion_id");
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}/purchases?${q}#add-purchase`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("purchaseError=project");
  if (!UUID.test(budgetLineId)) back("purchaseError=line");
  if (supplierId && !UUID.test(supplierId)) back("purchaseError=supplier");
  if (supplierId && newSupplier) back("purchaseError=supplierBoth");
  if (description.length === 0) back("purchaseError=description");
  if (description.length > MAX_TEXT || unit.length > MAX_UNIT || newSupplier.length > MAX_NAME) back("purchaseError=long");
  if (quantityRaw && !(/^\d{1,11}(\.\d{1,3})?$/.test(quantityRaw) && Number(quantityRaw) > 0)) back("purchaseError=quantity");
  const amount = parseAmount(get("amount"));
  if (!amount) back("purchaseError=amount");
  if (!isValidDate(purchasedOn)) back("purchaseError=date");
  if (assertionId && !UUID.test(assertionId)) back("purchaseError=assertion");

  const supabase = (await getSupabaseServerClient())!;
  const project = await loadProject(supabase, projectId);
  if (!project) back("purchaseError=project");
  const { base, today } = project!;
  if (purchasedOn > today) back("purchaseError=future");

  const money = resolveMoney(moneyFields(formData), base, purchasedOn, today);
  if (!money.ok) back(`purchaseError=${money.error}`);
  const m = money as Extract<typeof money, { ok: true }>;

  // The budget line must be one of this project's.
  const { data: line } = await supabase
    .from("budget_lines").select("id").eq("id", budgetLineId).eq("project_id", projectId).maybeSingle();
  if (!line) back("purchaseError=line");
  if (assertionId && !(await statementInProject(supabase, assertionId, projectId))) back("purchaseError=assertion");

  // A new supplier is created only after everything else has passed, so a
  // rejected form doesn't leave a stray supplier behind. Only the public
  // name is taken here; contact and bank details are private and not
  // collected by this form.
  let supplier = supplierId || null;
  if (newSupplier) {
    const { data: created, error: supplierError } = await supabase
      .from("suppliers").insert({ name: newSupplier }).select("id").single();
    if (supplierError || !created) {
      console.error("addPurchase: creating supplier failed:", supplierError?.message);
      back("purchaseError=save");
    }
    supplier = created!.id as string;
  }

  const { error } = await supabase.from("purchases").insert({
    project_id: projectId,
    budget_line_id: budgetLineId,
    supplier_id: supplier,
    description,
    quantity: quantityRaw || null,
    unit: unit || null,
    amount,
    currency: m.currency,
    exchange_rate: m.exchange_rate,
    rate_date: m.rate_date,
    rate_source: m.rate_source,
    purchased_on: purchasedOn,
    assertion_id: assertionId || null,
  });
  if (error) {
    console.error("addPurchase failed:", error.message);
    back(`purchaseError=${currencyError(error.message) ?? "save"}`);
  }

  revalidatePath(`/edit/${slug}/purchases`);
  back("purchaseAdded=1");
}

export async function addPayment(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const purchaseId = get("purchase_id");
  const paidOn = get("paid_on");
  const method = get("method");
  const assertionId = get("assertion_id");
  const reference = get("reference_number");
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}/purchases?${q}#add-payment`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("paymentError=project");
  if (!UUID.test(purchaseId)) back("paymentError=purchase");
  const amount = parseAmount(get("amount"));
  if (!amount || Number(amount) <= 0) back("paymentError=amount");
  if (!isValidDate(paidOn)) back("paymentError=date");
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) back("paymentError=method");
  if (assertionId && !UUID.test(assertionId)) back("paymentError=assertion");
  if (reference.length > MAX_NAME) back("paymentError=long");

  const supabase = (await getSupabaseServerClient())!;
  const project = await loadProject(supabase, projectId);
  if (!project) back("paymentError=project");
  const { base, today } = project!;
  if (paidOn > today) back("paymentError=future");

  const money = resolveMoney(moneyFields(formData), base, paidOn, today);
  if (!money.ok) back(`paymentError=${money.error}`);
  const m = money as Extract<typeof money, { ok: true }>;

  const { data: purchase } = await supabase
    .from("purchases").select("id").eq("id", purchaseId).eq("project_id", projectId).maybeSingle();
  if (!purchase) back("paymentError=purchase");
  if (assertionId && !(await statementInProject(supabase, assertionId, projectId))) back("paymentError=assertion");

  const { error } = await supabase.from("payments").insert({
    project_id: projectId,
    purchase_id: purchaseId,
    amount,
    currency: m.currency,
    exchange_rate: m.exchange_rate,
    rate_date: m.rate_date,
    rate_source: m.rate_source,
    paid_on: paidOn,
    method,
    assertion_id: assertionId || null,
    // PRIVATE: never shown on public pages.
    reference_number: reference || null,
  });
  if (error) {
    console.error("addPayment failed:", error.message);
    back(`paymentError=${currencyError(error.message) ?? "save"}`);
  }

  revalidatePath(`/edit/${slug}/purchases`);
  back("paymentAdded=1");
}
