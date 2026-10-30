import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { Passport } from "@/lib/passport";
import { KINGDOM_RETURN_DIMENSIONS } from "@/lib/types";

// Kingdom Return (backlog item 16; concept paper §6). Five dimensions, each
// a narrative plus linked evidence. Deliberately NO score, rating, rank,
// meter, or progress bar: fruit is documented, not reduced to a number.

export function KingdomReturn({ passport }: { passport: Passport }) {
  const { kingdomReturnEntries: entries, kingdomReturnLinks: links, assertions, evidence } = passport;
  const assertionById = new Map(assertions.map((a) => [a.id, a]));
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));

  return (
    <section aria-labelledby="kr-h">
      <h2 id="kr-h">Kingdom Return</h2>
      <p className="muted small">
        What fruit was produced, and can it continue? Each dimension is told in
        words and tied to the evidence above. There is no score.
      </p>

      {KINGDOM_RETURN_DIMENSIONS.map((dim) => {
        const dimEntries = entries.filter((e) => e.dimension === dim.key);
        return (
          <article key={dim.key} className="kr-dim">
            <h3>{dim.label}</h3>
            <p className="muted small kr-q">{dim.question}</p>
            {dimEntries.length === 0 ? (
              <p className="muted">Nothing recorded yet.</p>
            ) : (
              dimEntries.map((e) => {
                const eLinks = links.filter((l) => l.entry_id === e.id);
                return (
                  <div key={e.id} className="kr-entry">
                    <p>{e.narrative}</p>
                    <p className="muted small">
                      {formatDate(e.recorded_on)}{e.author_name && ` · ${e.author_name}`}
                    </p>
                    {eLinks.length > 0 ? (
                      <ul className="support">
                        {eLinks.map((l) => {
                          const a = l.assertion_id ? assertionById.get(l.assertion_id) : undefined;
                          const ev = l.evidence_item_id ? evidenceById.get(l.evidence_item_id) : undefined;
                          if (a) return (
                            <li key={l.id}><StatusBadge status={a.status} /> {a.statement}</li>
                          );
                          if (ev) return (
                            <li key={l.id}><span className="kind">Evidence</span> {ev.caption}</li>
                          );
                          return null;
                        })}
                      </ul>
                    ) : (
                      <p className="muted small">Not yet linked to any evidence.</p>
                    )}
                  </div>
                );
              })
            )}
          </article>
        );
      })}
    </section>
  );
}
