import Link from "next/link";
import { StatusBadge } from "@/app/components/StatusBadge";
import { StatusBar } from "@/app/components/passport/Summary";
import { formatDate, formatMoney } from "@/lib/format";
import type { ProjectSummary } from "@/lib/passport";

// One project as a card (backlog items 23f, 23g): used on the projects index
// and as the preview on the home page. The whole card is one link.

const STATUS_LABEL = { planned: "Planned", active: "Active", completed: "Completed", paused: "Paused" } as const;

export function ProjectCard({ summary, heading = "h2" }: { summary: ProjectSummary; heading?: "h2" | "h3" }) {
  const Heading = heading;
  const { project, organizationName, statusCounts, money, source } = summary;
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);
  const spentPct = money.approved > 0 ? Math.min(100, (money.spent / money.approved) * 100) : 0;

  return (
    <article className="project-card">
      <p className="card-meta">
        <span>{STATUS_LABEL[project.status]}</span>
        {source === "sample" && <span className="sample-tag">Sample</span>}
      </p>
      <Heading className="card-title">
        <Link href={`/p/${project.slug}`} className="card-link">{project.title}</Link>
      </Heading>
      <p className="muted small">
        {[organizationName, [project.region, project.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        {(start || end) && <><br />{start ?? "?"} – {end ?? "ongoing"}</>}
      </p>

      <StatusBar counts={statusCounts} />
      <p className="status-counts">
        <span>{statusCounts.verified} <StatusBadge status="verified" /></span>
        <span>{statusCounts.documented} <StatusBadge status="documented" /></span>
        <span>{statusCounts.claim} <StatusBadge status="claim" /></span>
      </p>

      {money.approved > 0 && (
        <div className="card-money">
          <span className="money-track" aria-hidden="true">
            <span className="money-fill money-spent" style={{ width: `${spentPct}%` }} />
          </span>
          <p className="muted small">
            {formatMoney(money.spent, project.base_currency)} spent of{" "}
            {formatMoney(money.approved, project.base_currency)} approved
          </p>
        </div>
      )}
    </article>
  );
}
