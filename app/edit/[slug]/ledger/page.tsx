import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDate, formatMoney, timeZoneLabel, todayInTimeZone } from "@/lib/format";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { MONEY_ERRORS, MoneyFields, StatementSelect, type AssertionRow } from "../form-parts";
import { addBudgetLine, addFundsReceived } from "./actions";

// Editor: budget lines and funds received (backlog item 21d). Money is only
// recorded here, never moved or collected. Statuses are read-only; they come
// from the statement each entry is linked to.

export const metadata: Metadata = { title: "Edit budget and funds — Light Web" };
export const dynamic = "force-dynamic";

const BUDGET_ERRORS: Record<string, string> = {
  ...MONEY_ERRORS,
  category: "Please name the budget line.",
  save: "The budget line couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};
const FUNDS_ERRORS: Record<string, string> = {
  ...MONEY_ERRORS,
  source: "Please choose the kind of source.",
  person: "Please choose a person from the list.",
  save: "The funds entry couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};

const FUNDS_SOURCE_LABEL = { individual: "Individual", church: "Church", foundation: "Foundation", local: "Local", other: "Other" };

type BudgetRow = {
  id: string; category: string; approved_amount: string; currency: string;
  approved_amount_base: string; approved_on: string | null; assertion_id: string | null;
};
type FundsRow = {
  id: string; amount: string; currency: string; amount_base: string; received_on: string;
  source_category: keyof typeof FUNDS_SOURCE_LABEL; assertion_id: string | null;
  donor_name: string | null; donor_person_id: string | null;
};
type PersonRow = { id: string; display_name: string; role_title: string | null };

export default async function EditLedger({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ budgetAdded?: string; budgetError?: string; fundsAdded?: string; fundsError?: string }>;
}) {
  const session = await getEditorSession();
  if (session.state === "not-configured" || session.state === "not-editor") redirect("/edit");
  if (session.state === "signed-out") redirect("/edit/sign-in");

  const { slug } = await params;
  const { budgetAdded, budgetError, fundsAdded, fundsError } = await searchParams;
  const supabase = (await getSupabaseServerClient())!;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<{ id: string; slug: string; title: string; base_currency: string; timezone?: string }>();
  if (!project) notFound();

  const [assertionsRes, budgetRes, fundsRes, peopleRes] = await Promise.all([
    supabase.from("assertions").select("id, statement, status").eq("project_id", project.id)
      .order("asserted_on", { ascending: false }),
    supabase.from("budget_lines")
      .select("id, category, approved_amount, currency, approved_amount_base, approved_on, assertion_id")
      .eq("project_id", project.id).order("category"),
    supabase.from("funds_received")
      .select("id, amount, currency, amount_base, received_on, source_category, assertion_id, donor_name, donor_person_id")
      .eq("project_id", project.id).order("received_on"),
    supabase.from("people").select("id, display_name, role_title").eq("is_beneficiary", false).order("display_name"),
  ]);
  const assertions = (assertionsRes.data ?? []) as AssertionRow[];
  const budget = (budgetRes.data ?? []) as BudgetRow[];
  const funds = (fundsRes.data ?? []) as FundsRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const statusOf = new Map(assertions.map((a) => [a.id, a.status]));
  const base = project.base_currency;
  const today = todayInTimeZone(project.timezone);

  const Status = ({ id }: { id: string | null }) => {
    const s = id ? statusOf.get(id) : undefined;
    return s ? <StatusBadge status={s} /> : <span className="status-badge status-none">– No statement</span>;
  };
  const original = (amount: string, currency: string) =>
    currency === base ? "" : ` (${formatMoney(amount, currency)})`;

  return (
    <main className="passport">
      <p className="crumbs">
        <Link href="/">Light Web</Link> / <Link href="/edit">Editor</Link> /{" "}
        <Link href={`/edit/${project.slug}`}>{project.title}</Link> / Budget and funds
      </p>
      <h1>Budget and funds</h1>
      <p className="small muted">
        Money is only recorded here; nothing is moved or collected. Totals are kept in{" "}
        {base}. Dates are the project&apos;s local dates ({timeZoneLabel(project.timezone)}).
      </p>

      <h2>Budget lines</h2>
      {budgetRes.error ? (
        <p className="form-error" role="alert">Couldn&apos;t load budget lines.</p>
      ) : budget.length === 0 ? (
        <p className="muted">No budget lines yet.</p>
      ) : (
        <ul className="statement-list">
          {budget.map((b) => (
            <li key={b.id}>
              <strong>{b.category}</strong> · {formatMoney(b.approved_amount_base, base)}
              {original(b.approved_amount, b.currency)} <Status id={b.assertion_id} />
              <p className="muted small">
                {b.approved_on ? `Approved ${formatDate(b.approved_on)}` : "Approval date not recorded"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 id="add-budget">Add a budget line</h3>
      {budgetAdded && <p className="sample-banner" role="status">Budget line recorded.</p>}
      {budgetError && BUDGET_ERRORS[budgetError] && (
        <p className="form-error" role="alert">{BUDGET_ERRORS[budgetError]}</p>
      )}
      <form action={addBudgetLine} className="editor-form">
        <input type="hidden" name="slug" value={project.slug} />
        <input type="hidden" name="project_id" value={project.id} />
        <label htmlFor="category">Budget line</label>
        <input id="category" name="category" type="text" maxLength={80} required placeholder="e.g. Materials" />
        <label htmlFor="b_description">Description (optional)</label>
        <textarea id="b_description" name="description" rows={2} maxLength={500} />
        <label htmlFor="approved_amount">Approved amount</label>
        <input id="approved_amount" name="approved_amount" type="text" inputMode="decimal" required placeholder="e.g. 6000" />
        <MoneyFields base={base} idPrefix="b" today={today} />
        <label htmlFor="approved_on">Date approved (optional)</label>
        <input id="approved_on" name="approved_on" type="date" max={today} />
        <StatementSelect id="b_assertion_id" assertions={assertions} />
        <button type="submit">Record budget line</button>
      </form>

      <h2>Funds received</h2>
      {fundsRes.error ? (
        <p className="form-error" role="alert">Couldn&apos;t load funds received.</p>
      ) : funds.length === 0 ? (
        <p className="muted">No funds recorded yet.</p>
      ) : (
        <ul className="statement-list">
          {funds.map((f) => (
            <li key={f.id}>
              <strong>{formatMoney(f.amount_base, base)}</strong>
              {original(f.amount, f.currency)} · {FUNDS_SOURCE_LABEL[f.source_category]}{" "}
              <Status id={f.assertion_id} />
              <p className="muted small">
                Received {formatDate(f.received_on)} ·{" "}
                {f.donor_name || f.donor_person_id ? "Giver recorded (private)" : "Giver not recorded"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 id="add-funds">Record funds received</h3>
      {fundsAdded && <p className="sample-banner" role="status">Funds recorded.</p>}
      {fundsError && FUNDS_ERRORS[fundsError] && (
        <p className="form-error" role="alert">{FUNDS_ERRORS[fundsError]}</p>
      )}
      <form action={addFundsReceived} className="editor-form">
        <input type="hidden" name="slug" value={project.slug} />
        <input type="hidden" name="project_id" value={project.id} />
        <label htmlFor="amount">Amount received</label>
        <input id="amount" name="amount" type="text" inputMode="decimal" required placeholder="e.g. 5000" />
        <MoneyFields base={base} idPrefix="f" today={today} />
        <label htmlFor="received_on">Date received</label>
        <input id="received_on" name="received_on" type="date" max={today} required />
        <label htmlFor="source_category">Kind of source (public)</label>
        <select id="source_category" name="source_category" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {Object.entries(FUNDS_SOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <StatementSelect id="f_assertion_id" assertions={assertions} />
        <fieldset className="gps">
          <legend>Who gave it (optional, private)</legend>
          <p className="small muted">
            Never shown publicly; only the kind of source is. A giver recorded as a
            person here can&apos;t later verify this project.
          </p>
          <label htmlFor="donor_person_id">Giver, if already in the people list</label>
          <select id="donor_person_id" name="donor_person_id" defaultValue="">
            <option value="">Not in the list</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}{p.role_title ? ` (${p.role_title})` : ""}
              </option>
            ))}
          </select>
          <label htmlFor="donor_name">Giver&apos;s name</label>
          <input id="donor_name" name="donor_name" type="text" maxLength={200} autoComplete="off" />
          <label htmlFor="donor_contact">Giver&apos;s contact</label>
          <input id="donor_contact" name="donor_contact" type="text" maxLength={200} autoComplete="off" />
          <label htmlFor="donor_reference">Gift reference</label>
          <input id="donor_reference" name="donor_reference" type="text" maxLength={200} autoComplete="off" />
        </fieldset>
        <button type="submit">Record funds</button>
      </form>
    </main>
  );
}
