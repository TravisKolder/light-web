import { isSupabaseConfigured } from "@/lib/supabase/client";
import Link from "next/link";
import { StatusBadge } from "@/app/components/StatusBadge";

export default function Home() {
  const configured = isSupabaseConfigured();
  return (
    <main>
      <h1>The Light Web</h1>
      <p className="tagline">Don&apos;t merely verify the story. Verify the fruit.</p>
      <p>
        This is the early prototype of a <strong>Project Passport</strong>: a
        record for one ministry project documenting who is responsible, the
        need, the approved budget, funds received, purchases and payments,
        evidence of delivery, independent verification, outcomes, lessons, and
        sustainability.
      </p>
      <p>
        Every assertion is kept in one of three distinct states: a{" "}
        <em>claim</em>, a <em>supporting document</em>, or an{" "}
        <em>independently verified result</em>.
      </p>
      <div className="badge-legend" aria-label="Assertion status legend">
        <StatusBadge status="claim" />
        <StatusBadge status="documented" />
        <StatusBadge status="verified" />
      </div>
      <p>
        <Link href="/projects/sample-kibira-classroom-block">
          View the sample Project Passport
        </Link>{" "}
        <span className="muted">(fictional)</span>
      </p>
      <p className="muted">
        Supabase: {configured ? "configured" : "not configured (see .env.example)"}
      </p>
    </main>
  );
}
