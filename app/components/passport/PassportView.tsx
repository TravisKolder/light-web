import Link from "next/link";
import type { Passport } from "@/lib/passport";
import type { LeaderRole, ProjectStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Ledger } from "./Ledger";
import { EvidenceList } from "./Evidence";
import { Results } from "./Results";
import { KingdomReturn } from "./KingdomReturn";
import { ReviewFlags } from "./ReviewFlags";

// The full Project Passport, rendered from public data only (items 12-17).
// Used by /projects/[slug] and the public read-only /p/[slug].

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  paused: "Paused",
};

const ROLE_LABEL: Record<LeaderRole, string> = {
  local_lead: "Local lead",
  treasurer: "Treasurer",
  board: "Board",
  staff: "Staff",
  other: "Other",
};

export function PassportView({ passport, publicView = false }: { passport: Passport; publicView?: boolean }) {
  const { project, organization, leaders } = passport;
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);

  return (
    <main className="passport">
      <p className="crumbs">
        <Link href="/">Light Web</Link> / Project Passport
        {publicView && <span className="muted"> · public read-only view</span>}
      </p>

      {passport.source === "sample" && (
        <p className="sample-banner" role="note">
          Sample data: this project, its people, places, and amounts are entirely fictional.
        </p>
      )}

      <header className="passport-header">
        <h1>{project.title}</h1>
        <dl className="facts">
          <div><dt>Status</dt><dd>{STATUS_LABEL[project.status]}</dd></div>
          {(project.region || project.country) && (
            <div><dt>Location</dt><dd>{[project.region, project.country].filter(Boolean).join(", ")}</dd></div>
          )}
          {(start || end) && (
            <div><dt>Dates</dt><dd>{start ?? "?"} – {end ?? "ongoing"}</dd></div>
          )}
          <div><dt>Reporting currency</dt><dd>{project.base_currency}</dd></div>
        </dl>
      </header>

      <section aria-labelledby="org-h">
        <h2 id="org-h">Responsible organization</h2>
        {organization ? (
          <>
            <p className="org-name">
              {organization.website ? (
                <a href={organization.website} rel="noopener noreferrer">{organization.name}</a>
              ) : organization.name}
            </p>
            {organization.description && <p>{organization.description}</p>}
          </>
        ) : (
          <p className="muted">Organization details are not public.</p>
        )}
      </section>

      <section aria-labelledby="leaders-h">
        <h2 id="leaders-h">Local leaders</h2>
        {leaders.length === 0 ? (
          <p className="muted">No leaders listed yet.</p>
        ) : (
          <ul className="leaders">
            {leaders.map((l, i) => (
              <li key={`${l.role}-${i}`}>
                <span className="leader-role">{ROLE_LABEL[l.role]}</span>
                {l.display_name ? (
                  <span>
                    {l.display_name}
                    {l.role_title && <span className="muted"> · {l.role_title}</span>}
                  </span>
                ) : (
                  <span className="muted">Name not shown publicly</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="need-h">
        <h2 id="need-h">The need</h2>
        <p>{project.need_statement ?? <span className="muted">Not recorded yet.</span>}</p>
      </section>

      <section aria-labelledby="obj-h">
        <h2 id="obj-h">Objectives</h2>
        {project.objectives && project.objectives.length > 0 ? (
          <ol className="objectives">
            {project.objectives.map((o, i) => <li key={i}>{o}</li>)}
          </ol>
        ) : (
          <p className="muted">Not recorded yet.</p>
        )}
      </section>

      <ReviewFlags passport={passport} />

      <Ledger passport={passport} />

      <EvidenceList passport={passport} />

      <Results passport={passport} />

      <KingdomReturn passport={passport} />
    </main>
  );
}
