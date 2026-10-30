import { NeedsReviewBadge } from "@/app/components/StatusBadge";
import { computeFlags } from "@/lib/flags";
import type { Passport } from "@/lib/passport";

// "Needs review" list (backlog item 19). Prompts for a person to look at,
// never verdicts.
export function ReviewFlags({ passport }: { passport: Passport }) {
  const flags = computeFlags(passport);
  return (
    <section aria-labelledby="flags-h">
      <h2 id="flags-h">Needs review</h2>
      <p className="muted small">
        Automatic consistency checks. A flag means someone should take a look; it is
        not a finding of wrongdoing.
      </p>
      {flags.length === 0 ? (
        <p className="muted">No consistency checks are flagged.</p>
      ) : (
        <ul className="flags">
          {flags.map((f) => (
            <li key={f.id}><NeedsReviewBadge /> {f.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
