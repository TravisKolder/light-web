import Link from "next/link";
import { ProjectCard } from "@/app/components/ProjectCard";
import { StatusBadge } from "@/app/components/StatusBadge";
import { listProjects, SAMPLE_PASSPORT } from "@/lib/passport";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { AssertionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// The three states, each with an example statement from the fictional sample
// passport (public data only).
const STATES: { status: AssertionStatus; text: string }[] = [
  { status: "claim", text: "The project says so. Nothing has been attached to support it yet." },
  { status: "documented", text: "A receipt, photo, report or other record is attached. Nobody independent has checked it." },
  { status: "verified", text: "Someone with no ties to the project has checked it and confirmed it." },
];

export default async function Home() {
  const configured = isSupabaseConfigured();
  // The home page still renders if the project list can't be loaded.
  const projects = await listProjects().catch(() => []);
  const featured = projects[0];
  const example = (s: AssertionStatus) =>
    SAMPLE_PASSPORT.assertions.find((a) => a.status === s)?.statement;

  return (
    <main className="home">
      <p className="kicker">The Light Web</p>
      <h1>Don&apos;t merely verify the story. Verify the fruit.</h1>
      <p className="lede">
        A <strong>Project Passport</strong> is a transparent record of one ministry
        project: who is responsible, the need, the approved budget, funds received,
        purchases and payments, evidence of delivery, independent verification,
        outcomes, lessons, and sustainability.
      </p>
      <p>
        <Link href={featured ? `/p/${featured.project.slug}` : "/p"} className="button">
          {featured ? "See the sample passport" : "Browse Project Passports"}
        </Link>
      </p>

      <h2 id="how-it-works">How it works</h2>
      <p>
        Every statement a project makes is kept in one of three states, and the three
        are never blurred together.
      </p>
      <ol className="states">
        {STATES.map(({ status, text }) => (
          <li key={status}>
            <StatusBadge status={status} />
            <p>{text}</p>
            {example(status) && (
              <p className="muted small example">
                Sample: &ldquo;{example(status)}&rdquo;
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="muted small">
        A statement moves forward only when a document is attached or an independent
        verifier confirms it. Nobody can set a status by hand, and a project&apos;s own
        people cannot verify its statements.
      </p>

      {featured && (
        <>
          <h2>{projects.length === 1 ? "Sample passport" : "Project Passports"}</h2>
          <ul className="project-cards">
            <li><ProjectCard summary={featured} heading="h3" /></li>
          </ul>
          {projects.length > 1 && <p><Link href="/p">All Project Passports</Link></p>}
        </>
      )}

      {/* Setup diagnostic: local development only, never on the public site. */}
      {process.env.NODE_ENV !== "production" && (
        <p className="muted small">
          Dev only — Supabase: {configured ? "configured" : "not configured (see .env.example)"}
        </p>
      )}
    </main>
  );
}
