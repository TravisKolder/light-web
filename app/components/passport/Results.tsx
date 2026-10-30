import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { Passport } from "@/lib/passport";
import type { AssertionStatus } from "@/lib/types";

// Progress reports, outcomes, lessons learned, sustainability (backlog
// item 15). Setbacks are shown as openly as progress.

function Badge({ id, statusOf }: { id: string | null; statusOf: Map<string, AssertionStatus> }) {
  const s = id ? statusOf.get(id) : undefined;
  return s ? <StatusBadge status={s} /> : null;
}

export function Results({ passport }: { passport: Passport }) {
  const statusOf = new Map(passport.assertions.map((a) => [a.id, a.status]));
  const { progressReports, outcomes, lessons, sustainabilityPlans } = passport;

  return (
    <>
      <section aria-labelledby="progress-h">
        <h2 id="progress-h">Progress reports</h2>
        {progressReports.length === 0 ? (
          <p className="muted">No progress reports yet.</p>
        ) : (
          progressReports.map((r) => (
            <article key={r.id} className="card">
              <div className="assertion-head">
                <strong>{formatDate(r.period_start)} – {formatDate(r.period_end)}</strong>
                {r.assertion_id && (
                  <span className="muted small">
                    linked claim <Badge id={r.assertion_id} statusOf={statusOf} />
                  </span>
                )}
              </div>
              <p>{r.summary}</p>
              {r.setbacks && (
                <p><span className="kind">Setbacks</span> {r.setbacks}</p>
              )}
              {r.author_name && <p className="muted small">Reported by {r.author_name}</p>}
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="outcomes-h">
        <h2 id="outcomes-h">Outcomes</h2>
        {outcomes.length === 0 ? (
          <p className="muted">No outcomes recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Outcome</th>
                  <th scope="col">Target</th>
                  <th scope="col">Achieved</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((o) => (
                  <tr key={o.id}>
                    <th scope="row">{o.description}</th>
                    <td>{o.target ?? "—"}</td>
                    <td>{o.achieved ?? "—"}</td>
                    <td><Badge id={o.assertion_id} statusOf={statusOf} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="lessons-h">
        <h2 id="lessons-h">Lessons learned</h2>
        {lessons.length === 0 ? (
          <p className="muted">No lessons recorded yet.</p>
        ) : (
          <ul className="support">
            {lessons.map((l) => (
              <li key={l.id}>
                {l.lesson} <span className="muted small">· {formatDate(l.recorded_on)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sustain-h">
        <h2 id="sustain-h">Sustainability</h2>
        {sustainabilityPlans.length === 0 ? (
          <p className="muted">No sustainability plan recorded yet.</p>
        ) : (
          sustainabilityPlans.map((s) => (
            <dl key={s.id} className="plan">
              <dt>Plan</dt><dd>{s.plan}</dd>
              {s.local_owner && (<><dt>Local owner</dt><dd>{s.local_owner}</dd></>)}
              {s.funding_after_grant && (<><dt>Funding after the grant</dt><dd>{s.funding_after_grant}</dd></>)}
              {s.review_on && (<><dt>Next review</dt><dd>{formatDate(s.review_on)}</dd></>)}
            </dl>
          ))
        )}
      </section>
    </>
  );
}
