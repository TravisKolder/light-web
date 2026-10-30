import { StatusBadge } from "@/app/components/StatusBadge";
import { formatAmount, formatDate, formatMoney } from "@/lib/format";
import type { Passport } from "@/lib/passport";
import type { AssertionStatus, FundsSourceCategory, RecordedAmount } from "@/lib/types";

// Budget-vs-actual ledger (backlog item 13). Money is only recorded here.
// Totals are in the project's reporting currency (amount_base); rows in
// another currency also show the original amount and the rate used.

const SOURCE_LABEL: Record<FundsSourceCategory, string> = {
  individual: "Individual",
  church: "Church",
  foundation: "Foundation",
  local: "Local",
  other: "Other",
};

function Status({ id, statusOf }: { id: string | null; statusOf: Map<string, AssertionStatus> }) {
  const s = id ? statusOf.get(id) : undefined;
  return s ? <StatusBadge status={s} /> : <span className="muted small">No assertion</span>;
}

function Original({ row, base }: { row: RecordedAmount; base: string }) {
  if (row.currency === base) return null;
  return (
    <div className="muted small">
      {formatMoney(row.amount, row.currency)} @ {Number(row.exchange_rate)} ({row.rate_source.replace("_", " ")}, {formatDate(row.rate_date)})
    </div>
  );
}

export function Ledger({ passport }: { passport: Passport }) {
  const base = passport.project.base_currency;
  const statusOf = new Map(passport.assertions.map((a) => [a.id, a.status]));
  const lines = passport.budgetVsActual;
  const sum = (xs: (string | number)[]) => xs.reduce<number>((t, x) => t + Number(x), 0);

  const approved = sum(lines.map((l) => l.approved_amount_base));
  const spent = sum(lines.map((l) => l.spent_base));
  const received = sum(passport.fundsReceived.map((f) => f.amount_base));

  return (
    <section aria-labelledby="ledger-h">
      <h2 id="ledger-h">Budget and spending</h2>
      <p className="muted small">
        Recorded amounts in {base}. Spent = payments recorded against each line&apos;s purchases.
      </p>

      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Budget line</th>
              <th scope="col" className="num">Approved ({base})</th>
              <th scope="col" className="num">Spent ({base})</th>
              <th scope="col" className="num">Remaining ({base})</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const over = Number(l.remaining_base) < 0;
              return (
                <tr key={l.budget_line_id}>
                  <th scope="row">{l.category}</th>
                  <td className="num">{formatAmount(l.approved_amount_base, base)}</td>
                  <td className="num">{formatAmount(l.spent_base, base)}</td>
                  <td className={`num${over ? " over" : ""}`}>
                    {formatAmount(l.remaining_base, base)}
                    {over && <div className="small">Over budget</div>}
                  </td>
                  <td><Status id={l.assertion_id} statusOf={statusOf} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num">{formatAmount(approved, base)}</td>
              <td className="num">{formatAmount(spent, base)}</td>
              <td className="num">{formatAmount(approved - spent, base)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <h3>Funds received</h3>
      <p className="muted small">Givers&apos; identities are private; only the kind of source is shown.</p>
      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Source</th>
              <th scope="col" className="num">Amount ({base})</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {passport.fundsReceived.map((f) => (
              <tr key={f.id}>
                <td>{formatDate(f.received_on)}</td>
                <td>{SOURCE_LABEL[f.source_category]}</td>
                <td className="num">
                  {formatAmount(f.amount_base, base)}
                  <Original row={f} base={base} />
                </td>
                <td><Status id={f.assertion_id} statusOf={statusOf} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>Total received</th>
              <td className="num">{formatAmount(received, base)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <dl className="facts ledger-summary">
        <div><dt>Received</dt><dd>{formatMoney(received, base)}</dd></div>
        <div><dt>Spent</dt><dd>{formatMoney(spent, base)}</dd></div>
        <div><dt>Recorded balance</dt><dd>{formatMoney(received - spent, base)}</dd></div>
      </dl>

      <h3>Purchases</h3>
      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">What and from whom</th>
              <th scope="col" className="num">Cost ({base})</th>
              <th scope="col" className="num">Paid ({base})</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {passport.purchases.map((p) => {
              const paid = sum(passport.payments.filter((x) => x.purchase_id === p.id).map((x) => x.amount_base));
              const line = passport.budgetLines.find((b) => b.id === p.budget_line_id);
              return (
                <tr key={p.id}>
                  <td>{formatDate(p.purchased_on)}</td>
                  <td>
                    {p.quantity != null && `${Number(p.quantity)} ${p.unit ?? ""} · `}{p.description}
                    <div className="muted small">
                      {p.supplier_name ?? "Supplier not shown"}{line && ` · ${line.category}`}
                    </div>
                  </td>
                  <td className="num">
                    {formatAmount(p.amount_base, base)}
                    <Original row={p} base={base} />
                  </td>
                  <td className="num">{formatAmount(paid, base)}</td>
                  <td><Status id={p.assertion_id} statusOf={statusOf} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
