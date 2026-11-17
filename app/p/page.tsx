import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/app/components/ProjectCard";
import { listProjects } from "@/lib/passport";

// Projects index (backlog items 18, 23g): every public project as a card with
// a summary of how many of its statements are claims, documented, or
// independently verified. Counts are context, not a rating.

export const metadata: Metadata = { title: "Projects — Light Web" };
export const dynamic = "force-dynamic";

export default async function ProjectsIndex() {
  const projects = await listProjects();

  return (
    <main className="passport">
      <p className="crumbs"><Link href="/">Light Web</Link> / Projects</p>
      <h1>Project Passports</h1>
      <p className="muted">
        Each passport records what a project says, what supports it, and what has
        been independently verified. Counts are context, not a rating.
      </p>
      {projects.length === 0 ? (
        <div className="empty-state">
          <p><strong>No public projects yet.</strong></p>
          <p className="muted">
            Passports appear here once a project&apos;s organization makes its record public.
          </p>
        </div>
      ) : (
        <ul className="project-cards">
          {projects.map((summary) => (
            <li key={summary.project.id}><ProjectCard summary={summary} /></li>
          ))}
        </ul>
      )}
    </main>
  );
}
