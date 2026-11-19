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
      <section className="hero">
        <div className="wrap">
          <div>
            <p className="kicker">Project Passports for ministry work</p>
            <h1>
              Don&apos;t merely verify the story. <span className="glow">Verify the fruit.</span>
            </h1>
            <p className="lede">
              A <strong>Project Passport</strong> is a transparent record of one ministry
              project: who is responsible, the need, the approved budget, funds received,
              purchases and payments, evidence of delivery, independent verification,
              outcomes, lessons, and sustainability.
            </p>
            <p className="cta-row">
              <Link href={featured ? `/p/${featured.project.slug}` : "/p"} className="button">
                {featured ? "See the sample passport" : "Browse Project Passports"}
              </Link>
              <a href="#how-it-works" className="button secondary">How it works</a>
            </p>
          </div>
          <div className="hero-card" aria-hidden="true">
            <p className="hc-label">Every statement, one of three states</p>
            <ol>
              {STATES.map(({ status, text }) => (
                <li key={status}>
                  <StatusBadge status={status} />
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="home-section" aria-labelledby="how-it-works">
        <div className="wrap">
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
          <ul className="principles">
            <li>
              <strong>Money is recorded, never moved</strong>
              <span>Budgets, gifts, purchases and payments are written down here. Nothing is collected or paid through the site.</span>
            </li>
            <li>
              <strong>Private by default</strong>
              <span>Givers and workers stay private unless they choose otherwise, and the people served are never shown.</span>
            </li>
            <li>
              <strong>Fruit, not a score</strong>
              <span>Kingdom Return is told as evidence and story across five dimensions, never boiled down to a number.</span>
            </li>
          </ul>
        </div>
      </section>

      {featured && (
        <section className="home-section" aria-labelledby="featured-h">
          <div className="wrap">
            <h2 id="featured-h">{projects.length === 1 ? "Sample passport" : "Project Passports"}</h2>
            <ul className="project-cards">
              <li><ProjectCard summary={featured} heading="h3" /></li>
            </ul>
            {projects.length > 1 && <p><Link href="/p">All Project Passports</Link></p>}
          </div>
        </section>
      )}

      {/* Setup diagnostic: local development only, never on the public site. */}
      {process.env.NODE_ENV !== "production" && (
        <div className="wrap">
          <p className="muted small" style={{ marginTop: 32 }}>
            Dev only — Supabase: {configured ? "configured" : "not configured (see .env.example)"}
          </p>
        </div>
      )}
    </main>
  );
}
