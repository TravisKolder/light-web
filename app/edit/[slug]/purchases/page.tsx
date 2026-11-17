import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDate, formatMoney, timeZoneLabel, todayInTimeZone } from "@/lib/format";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { MONEY_ERRORS, MoneyFields, StatementSelect, type AssertionRow } from "../form-parts";
import { addPayment, addPurchase } from "./actions";

// Editor: purchases and payments (backlog item 21e). Money is only recorded
// here, never paid or moved. Statuses are read-only; they come from the
// statement each entry is linked to.

export const metadata: Metadata = { title: "Edit purchases and payments — Light Web" };
export const dynamic = "force-dynamic";

const PURCHASE_ERRORS: Record<string, string> = {
  ...MONEY_ERRORS,
  line: "Please choose one of this project's budget lines.",
  supplier: "Please choose a supplier from the list.",
  supplierBoth: "Choose a supplier from the list or type a new one, not both.",
  description: "Please say what was bought.",
  quantity: "Please enter the quantity as a number above zero, like 40 or 2.5.",
  save: "The purchase couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};
const PAYMENT_ERRORS: Record<string, string> = {
  ...MONEY_ERRORS,
  amount: "Please enter the amount paid as a number above zero, like 1250 or 1250.50.",
  purchase: "Please choose one of this project's purchases.",
  method: "Please choose how it was paid.",
  save: "The payment couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};

const METHOD_LABEL = { bank_transfer: "Bank transfer", mobile_money: "Mobile money", cash: "Cash", check: "Cheque" };

type LineRow = { id: string; category: string };
type SupplierRow = { id: string; name: string };
type PurchaseRow = {
  id: string; description: string; quantity: string | null; unit: string | null;
  amount: string; currency: string; amount_base: string; purchased_on: string;
  budget_line_id: string; supplier_id: string | null; assertion_id: string | null;
};
type PaymentRow = {
  id: string; purchase_id: string; amount: string; currency: string; amount_base: string;
  paid_on: string; method: keyof typeof METHOD_LABEL; assertion_id: string | null;
};

export default async function EditPurchases({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchaseAdded?: string; purchaseError?: string; paymentAdded?: string; paymentError?: string }>;
}) {
  const session = await getEditorSession();
  if (session.state === "not-configured" || session.state === "not-editor") redirect("/edit");
  if (session.state === "signed-out") redirect("/edit/sign-in");

  const { slug } = await params;
  const { purchaseAdded, purchaseError, paymentAdded, paymentError } = await searchParams;
  const supabase = (await getSupabaseServerClient())!;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<{ id: string; slug: string; title: string; base_currency: string; timezone?: string }>();
  if (!project) notFound();

  const [assertionsRes, linesRes, suppliersRes, purchasesRes, paymentsRes] = await Promise.all([
    supabase.from("assertions").select("id, statement, status").eq("project_id", project.id)
      .order("asserted_on", { ascending: false }),
    supabase.from("budget_lines").select("id, category").eq("project_id", project.id).order("category"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("purchases")
      .select("id, description, quantity, unit, amount, currency, amount_base, purchased_on, budget_line_id, supplier_id, assertion_id")
      .eq("project_id", project.id).order("purchased_on"),
    supabase.from("payments")
      .select("id, purchase_id, amount, currency, amount_base, paid_on, method, assertion_id")
      .eq("project_id", project.id).order("paid_on"),
  ]);
  const assertions = (assertionsRes.data ?? []) as AssertionRow[];
  const lines = (linesRes.data ?? []) as LineRow[];
  const suppliers = (suppliersRes.data ?? []) as SupplierRow[];
  const purchases = (purchasesRes.data ?? []) as PurchaseRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const statusOf = new Map(assertions.map((a) => [a.id, a.status]));
  const lineName = new Map(lines.map((l) => [l.id, l.category]));
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const base = project.base_currency;
  const today = todayInTimeZone(project.timezone);

  const Status = ({ id }: { id: string | null }) => {
    const s = id ? statusOf.get(id) : undefined;
    return s ? <StatusBadge status={s} /> : <span className="status-badge status-none">– No statement</span>;
  };
  const original = (amount: string, currency: string) =>
    currency === base ? "" : ` (${formatMoney(amount, currency)})`;
  const what = (p: PurchaseRow) =>
    `${p.quantity != null ? `${Number(p.quantity)} ${p.unit ?? ""} · ` : ""}${p.description}`;

  return (
    <main className="passport">
      <p className="crumbs">
        <Link href="/">Light Web</Link> / <Link href="/edit">Editor</Link> /{" "}
        <Link href={`/edit/${project.slug}`}>{project.title}</Link> / Purchases and payments
      </p>
      <h1>Purchases and payments</h1>
      <p className="small muted">
        Money is only recorded here; nothing is paid or moved. Totals are kept in {base}.
        Dates are the project&apos;s local dates ({timeZoneLabel(project.timezone)}).
      </p>

      <h2>Purchases</h2>
      {purchasesRes.error ? (
        <p className="form-error" role="alert">Couldn&apos;t load purchases.</p>
      ) : purchases.length === 0 ? (
        <p className="muted">No purchases yet.</p>
      ) : (
        <ul className="statement-list">
          {purchases.map((p) => {
            const pays = payments.filter((x) => x.purchase_id === p.id);
            const paid = pays.reduce((t, x) => t + Number(x.amount_base), 0);
            return (
              <li key={p.id}>
                <strong>{what(p)}</strong> · {formatMoney(p.amount_base, base)}
                {original(p.amount, p.currency)} <Status id={p.assertion_id} />
                <p className="muted small">
                  {formatDate(p.purchased_on)} · {lineName.get(p.budget_line_id) ?? "Budget line"} ·{" "}
                  {p.supplier_id ? supplierName.get(p.supplier_id) ?? "Supplier" : "Supplier not recorded"}
                </p>
                {pays.length === 0 ? (
                  <p className="muted small">No payments recorded.</p>
                ) : (
                  <ul className="payment-list">
                    {pays.map((x) => (
                      <li key={x.id} className="small">
                        Paid {formatMoney(x.amount_base, base)}{original(x.amount, x.currency)} on{" "}
                        {formatDate(x.paid_on)} by {METHOD_LABEL[x.method].toLowerCase()}{" "}
                        <Status id={x.assertion_id} />
                      </li>
                    ))}
                    <li className="small muted">
                      Paid so far: {formatMoney(paid, base)} of {formatMoney(p.amount_base, base)}
                    </li>
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h3 id="add-purchase">Record a purchase</h3>
      {purchaseAdded && <p className="sample-banner" role="status">Purchase recorded.</p>}
      {purchaseError && PURCHASE_ERRORS[purchaseError] && (
        <p className="form-error" role="alert">{PURCHASE_ERRORS[purchaseError]}</p>
      )}
      {lines.length === 0 ? (
        <p className="muted">
          Add a budget line first (
          <Link href={`/edit/${project.slug}/ledger`}>Budget and funds</Link>); every purchase is
          recorded against one.
        </p>
      ) : (
        <form action={addPurchase} className="editor-form">
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="project_id" value={project.id} />
          <label htmlFor="budget_line_id">Budget line</label>
          <select id="budget_line_id" name="budget_line_id" required defaultValue="">
            <option value="" disabled>Choose a budget line…</option>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.category}</option>)}
          </select>
          <label htmlFor="description">What was bought</label>
          <input id="description" name="description" type="text" maxLength={300} required placeholder="e.g. Cement, 50 kg bags" />
          <label htmlFor="quantity">Quantity (optional)</label>
          <input id="quantity" name="quantity" type="text" inputMode="decimal" placeholder="e.g. 40" />
          <label htmlFor="unit">Unit (optional)</label>
          <input id="unit" name="unit" type="text" maxLength={40} placeholder="e.g. bags" />
          <label htmlFor="p_amount">Total cost</label>
          <input id="p_amount" name="amount" type="text" inputMode="decimal" required placeholder="e.g. 299.70" />
          <MoneyFields base={base} idPrefix="p" today={today} />
          <label htmlFor="purchased_on">Date of purchase</label>
          <input id="purchased_on" name="purchased_on" type="date" max={today} required />
          <fieldset className="gps">
            <legend>Supplier (optional)</legend>
            <p className="small muted">
              The supplier&apos;s name is public. Contact and bank details are private and
              aren&apos;t collected here.
            </p>
            <label htmlFor="supplier_id">Choose a supplier</label>
            <select id="supplier_id" name="supplier_id" defaultValue="">
              <option value="">None / not in the list</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label htmlFor="new_supplier_name">Or add a new supplier by name</label>
            <input id="new_supplier_name" name="new_supplier_name" type="text" maxLength={200} autoComplete="off" />
          </fieldset>
          <StatementSelect id="p_assertion_id" assertions={assertions} />
          <button type="submit">Record purchase</button>
        </form>
      )}

      <h3 id="add-payment">Record a payment</h3>
      {paymentAdded && <p className="sample-banner" role="status">Payment recorded.</p>}
      {paymentError && PAYMENT_ERRORS[paymentError] && (
        <p className="form-error" role="alert">{PAYMENT_ERRORS[paymentError]}</p>
      )}
      {purchases.length === 0 ? (
        <p className="muted">Record a purchase first; every payment is for a purchase.</p>
      ) : (
        <form action={addPayment} className="editor-form">
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="project_id" value={project.id} />
          <label htmlFor="purchase_id">Payment for which purchase</label>
          <select id="purchase_id" name="purchase_id" required defaultValue="">
            <option value="" disabled>Choose a purchase…</option>
            {purchases.map((p) => (
              <option key={p.id} value={p.id}>
                {formatDate(p.purchased_on)} · {what(p).slice(0, 70)}
              </option>
            ))}
          </select>
          <label htmlFor="pay_amount">Amount paid</label>
          <input id="pay_amount" name="amount" type="text" inputMode="decimal" required placeholder="e.g. 299.70" />
          <MoneyFields base={base} idPrefix="pay" today={today} />
          <label htmlFor="paid_on">Date paid</label>
          <input id="paid_on" name="paid_on" type="date" max={today} required />
          <label htmlFor="method">How it was paid</label>
          <select id="method" name="method" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <StatementSelect id="pay_assertion_id" assertions={assertions} />
          <label htmlFor="reference_number">Transaction reference (optional, private)</label>
          <input id="reference_number" name="reference_number" type="text" maxLength={200} autoComplete="off" />
          <p className="small muted">Never shown publicly.</p>
          <button type="submit">Record payment</button>
        </form>
      )}
    </main>
  );
}
