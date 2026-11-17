import type { Metadata } from "next";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { KINGDOM_RETURN_DIMENSIONS } from "@/lib/types";
import type { AssertionRow } from "../form-parts";
import { Crumbs, FormMessages, PersonSelect, ProjectFields, loadEditorProject } from "../page-helpers";
import { addKingdomReturnEntry } from "./actions";

// Editor: Kingdom Return entries (backlog item 25b; concept paper §6). Five
// dimensions, each told in words and tied to statements and evidence.
// Deliberately NO score, rating, rank, meter or progress bar.

export const metadata: Metadata = { title: "Edit Kingdom Return — Light Web" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  project: "That project couldn't be found. Go back to the editor home and try again.",
  dimension: "Please choose one of the five dimensions.",
  narrative: "Please write the narrative.",
  long: "The narrative is too long (4,000 characters at most).",
  date: "Please enter a valid date.",
  future: "The date can't be in the future.",
  person: "Please choose a person from the list.",
  links: "One of the ticked statements or evidence items isn't part of this project. Reload the page and try again.",
  linksNotSaved: "The entry was saved, but its links to statements and evidence were not. Tell Travis.",
  save: "The entry couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};

type EntryRow = { id: string; dimension: string; narrative: string; recorded_on: string };
type LinkRow = { entry_id: string; assertion_id: string | null; evidence_item_id: string | null };
type EvidenceRow = { id: string; caption: string; shows_identifiable_people: boolean };
type PersonRow = { id: string; display_name: string; role_title: string | null };

const short = (s: string, n = 100) => (s.length > n ? `${s.slice(0, n)}…` : s);

export default async function EditKingdomReturn({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ added?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { added, error } = await searchParams;
  const { supabase, project, today, zone } = await loadEditorProject(slug);

  const [assertionsRes, evidenceRes, entriesRes, linksRes, peopleRes] = await Promise.all([
    supabase.from("assertions").select("id, statement, status").eq("project_id", project.id)
      .order("asserted_on", { ascending: false }),
    supabase.from("evidence_items").select("id, caption, shows_identifiable_people").eq("project_id", project.id)
      .order("created_at"),
    supabase.from("kingdom_return_entries").select("id, dimension, narrative, recorded_on")
      .eq("project_id", project.id).order("recorded_on"),
    supabase.from("kingdom_return_links").select("entry_id, assertion_id, evidence_item_id").eq("project_id", project.id),
    supabase.from("people").select("id, display_name, role_title").eq("is_beneficiary", false).order("display_name"),
  ]);
  const assertions = (assertionsRes.data ?? []) as AssertionRow[];
  const evidence = (evidenceRes.data ?? []) as EvidenceRow[];
  const entries = (entriesRes.data ?? []) as EntryRow[];
  const links = (linksRes.data ?? []) as LinkRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const assertionById = new Map(assertions.map((a) => [a.id, a]));
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));

  return (
    <main className="passport">
      <Crumbs project={project} here="Kingdom Return" />
      <h1>Kingdom Return</h1>
      <p className="small muted">
        What fruit was produced, and can it continue? Each dimension is told in words
        and tied to statements and evidence. <strong>There is no score</strong>: fruit is
        documented, not reduced to a number. Entries are public on the passport. Dates
        are the project&apos;s local dates ({zone}).
      </p>

      {KINGDOM_RETURN_DIMENSIONS.map((dim) => {
        const dimEntries = entries.filter((e) => e.dimension === dim.key);
        return (
          <section key={dim.key} className="kr-dim">
            <h3>{dim.label}</h3>
            <p className="muted small kr-q">{dim.question}</p>
            {dimEntries.length === 0 ? (
              <p className="muted">Nothing recorded yet.</p>
            ) : (
              dimEntries.map((e) => {
                const mine = links.filter((l) => l.entry_id === e.id);
                return (
                  <div key={e.id} className="kr-entry">
                    <p>{e.narrative}</p>
                    <p className="muted small">Recorded {formatDate(e.recorded_on)}</p>
                    {mine.length === 0 ? (
                      <p className="muted small">Not tied to any statement or evidence yet.</p>
                    ) : (
                      <ul className="support">
                        {mine.map((l, i) => {
                          const a = l.assertion_id ? assertionById.get(l.assertion_id) : undefined;
                          const ev = l.evidence_item_id ? evidenceById.get(l.evidence_item_id) : undefined;
                          return (
                            <li key={i} className="small">
                              {a && <><StatusBadge status={a.status} /> {short(a.statement)}</>}
                              {ev && <>Evidence: {short(ev.caption)}{ev.shows_identifiable_people && " (private)"}</>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </section>
        );
      })}

      <h2 id="add-entry">Add an entry</h2>
      <FormMessages added={added} addedText="Entry recorded." error={error} errors={ERRORS} />
      <form action={addKingdomReturnEntry} className="editor-form wide-form">
        <ProjectFields project={project} />
        <label htmlFor="dimension">Dimension</label>
        <select id="dimension" name="dimension" required defaultValue="">
          <option value="" disabled>Choose a dimension…</option>
          {KINGDOM_RETURN_DIMENSIONS.map((d) => (
            <option key={d.key} value={d.key}>{d.label}: {d.question}</option>
          ))}
        </select>
        <label htmlFor="narrative">Narrative</label>
        <textarea id="narrative" name="narrative" rows={5} maxLength={4000} required />
        <p className="small muted">
          Say what happened in plain words, including what didn&apos;t go well. Leave out
          private details about people.
        </p>
        <label htmlFor="recorded_on">Date recorded</label>
        <input id="recorded_on" name="recorded_on" type="date" defaultValue={today} max={today} />
        <PersonSelect id="author_id" name="author_id" label="Written by" people={people} />
        <p className="small muted">Whoever writes an entry can&apos;t later verify this project.</p>

        <fieldset className="gps">
          <legend>Statements this entry rests on</legend>
          {assertions.length === 0 ? <p className="small muted">No statements yet.</p> : assertions.map((a) => (
            <label key={a.id} className="checkbox">
              <input type="checkbox" name="link_assertion" value={a.id} />
              <span><StatusBadge status={a.status} /> {short(a.statement, 140)}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="gps">
          <legend>Evidence this entry rests on</legend>
          {evidence.length === 0 ? <p className="small muted">No evidence yet.</p> : evidence.map((e) => (
            <label key={e.id} className="checkbox">
              <input type="checkbox" name="link_evidence" value={e.id} />
              <span>
                {short(e.caption, 140)}
                {e.shows_identifiable_people && <span className="muted"> (private: not shown on the passport)</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="small muted">
          A reader sees each linked statement with its own status, so a narrative that
          rests only on claims looks different from one that rests on verified results.
        </p>
        <button type="submit">Record entry</button>
      </form>
    </main>
  );
}
