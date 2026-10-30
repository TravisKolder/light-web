import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/app/components/StatusBadge";
import { listProjects } from "@/lib/passport";

// Projects index (backlog item 18): every public project with a summary of
// how many of its claims are claims, documented, or independently verified.
// Counts are context, not a rating.

export const metadata: Metadata = { title: "Projects — Light Web" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = { planned: "Planned", active: "Active", completed: "Completed", paused: "Paused" } as const;

export default async function ProjectsIndex() {
  const projects = await listProjects();

  return (
    <main className="passport">
      <p className="crumbs"><Link href="/">Light Web</Link> / Projects</p>
      <h1>Project Passports</h1>
      {projects.some((p) => p.source === "sample") && (
        <p className="sample-banner" role="note">
          Sample data: the project below is entirely fictional.
        </p>
      )}
      {projects.length === 0 ? (
        <p className="muted">No public projects yet.</p>
      ) : (
        <ul className="project-list">
          {projects.map(({ project, organizationName, statusCounts }) => (
            <li key={project.id}>
              <Link href={`/p/${project.slug}`} className="project-title">{project.title}</Link>
              <p className="muted small">
                {[organizationName, project.region, STATUS_LABEL[project.status]].filter(Boolean).join(" · ")}
              </p>
              <p className="status-counts">
                <span><StatusBadge status="verified" /> {statusCounts.verified}</span>
                <span><StatusBadge status="documented" /> {statusCounts.documented}</span>
                <span><StatusBadge status="claim" /> {statusCounts.claim}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
