import { StatusBadge } from "@/app/components/StatusBadge";
import { computeFlags } from "@/lib/flags";
import { formatDate, formatMoney } from "@/lib/format";
import type { Passport } from "@/lib/passport";
import { activeAssertions, type AssertionStatus } from "@/lib/types";

// Summary band at the top of a Passport (backlog item 23a): how many
// statements are claims / documented / verified, the money at a glance, and
// whether anything is flagged for review. Counts are context, never a score.

const ORDER: AssertionStatus[] = ["verified", "documented", "claim"];

/** Proportional bar of the three states; shared with the projects index. */
export function StatusBar({ counts }: { counts: Record<AssertionStatus, number> }) {
  const total = ORDER.reduce((t, s) => t + counts[s], 0);
  if (total === 0) return null;
  return (
    <div
      className="status-bar"
      role="img"
      aria-label={`${counts.verified} verified, ${counts.documented} documented, ${counts.claim} claims`}
    >
      {ORDER.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} className={`seg seg-${s}`} style={{ flexGrow: counts[s] }} />
      ))}
    </div>
  );
}

export function Summary({ passport }: { passport: Passport }) {
  const base = passport.project.base_currency;
  const counts: Record<AssertionStatus, number> = { claim: 0, documented: 0, verified: 0 };
  // Withdrawn statements stay on the record but don't count (26b2).
  const active = activeAssertions(passport.assertions);
  for (const a of active) counts[a.status] += 1;
  const total = active.length;
  const withdrawn = passport.assertions.length - total;

  const sum = (xs: (string | number)[]) => xs.reduce<number>((t, x) => t + Number(x), 0);
  const approved = sum(passport.budgetVsActual.map((l) => l.approved_amount_base));
  const spent = sum(passport.budgetVsActual.map((l) => l.spent_base));
  const received = sum(passport.fundsReceived.map((f) => f.amount_base));
  const scale = Math.max(approved, received, spent);
  const pct = (x: number) => (scale > 0 ? `${Math.max(0, Math.min(100, (x / scale) * 100))}%` : "0%");

  const flags = computeFlags(passport).length;

  // The most recent date recorded anywhere in the passport.
  const dates = [
    ...passport.assertions.map((a) => a.asserted_on),
    ...passport.fundsReceived.map((f) => f.received_on),
    ...passport.purchases.map((p) => p.purchased_on),
    ...passport.payments.map((p) => p.paid_on),
    ...passport.documents.map((d) => d.issued_on),
    ...passport.verifications.map((v) => v.verified_on),
    ...passport.evidence.map((e) => e.captured_on),
    ...passport.progressReports.map((r) => r.period_end),
  ].filter((d): d is string => Boolean(d)).sort();
  const latest = formatDate(dates.at(-1));

  return (
    <section className="summary" aria-labelledby="summary-h">
      <h2 id="summary-h" className="visually-hidden">Summary</h2>

      <div className="summary-block">
        <p className="summary-label">
          {total} statement{total === 1 ? "" : "s"} made by this project
          {withdrawn > 0 && (
            <>
              {" "}<a href="#evidence-h">(+{withdrawn} withdrawn)</a>
            </>
          )}
        </p>
        <ul className="summary-counts">
          {ORDER.map((s) => (
            <li key={s}>
              <span className="big-num">{counts[s]}</span>
              <StatusBadge status={s} />
            </li>
          ))}
        </ul>
        <StatusBar counts={counts} />
        <p className="muted small">Counts are context, not a rating.</p>
      </div>

      <div className="summary-block">
        <p className="summary-label">Money recorded ({base})</p>
        <dl className="money-bars">
          {([["Approved budget", approved, "approved"], ["Funds received", received, "received"], ["Spent", spent, "spent"]] as const).map(
            ([label, value, cls]) => (
              <div key={cls}>
                <dt>{label}</dt>
                <dd>
                  <span className="money-value">{formatMoney(value, base)}</span>
                  <span className="money-track" aria-hidden="true">
                    <span className={`money-fill money-${cls}`} style={{ width: pct(value) }} />
                  </span>
                </dd>
              </div>
            ),
          )}
        </dl>
      </div>

      <p className="summary-foot">
        {flags > 0 ? (
          <a href="#flags-h" className="review-chip">
            <span aria-hidden="true">⚑</span> {flags} item{flags === 1 ? "" : "s"} need{flags === 1 ? "s" : ""} review
          </a>
        ) : (
          <span className="muted small">No consistency checks are flagged.</span>
        )}
        {latest && <span className="muted small">Latest dated entry: {latest}</span>}
      </p>
    </section>
  );
}
