import type { Metadata } from "next";
import { formatDate } from "@/lib/format";
import { StatementSelect, type AssertionRow } from "../form-parts";
import { Crumbs, EntryStatus, FormMessages, PersonSelect, ProjectFields, loadEditorProject } from "../page-helpers";
import { addLesson, addOutcome, addProgressReport, addSustainabilityPlan } from "./actions";

// Editor: progress reports, outcomes, lessons learned and the sustainability
// plan (backlog item 25a). Statuses are read-only; they come from the
// statement an entry is linked to.

export const metadata: Metadata = { title: "Edit reports and results — Light Web" };
export const dynamic = "force-dynamic";

const COMMON: Record<string, string> = {
  project: "That project couldn't be found. Go back to the editor home and try again.",
  date: "Please enter valid dates.",
  future: "The date can't be in the future.",
  assertion: "Please choose one of this project's statements.",
  person: "Please choose a person from the list.",
  long: "One of the text boxes is too long.",
  save: "It couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};
const REPORT_ERRORS = { ...COMMON, order: "The period must start on or before the day it ends.", summary: "Please write the summary." };
const OUTCOME_ERRORS = { ...COMMON, description: "Please describe the outcome." };
const LESSON_ERRORS = { ...COMMON, lesson: "Please write the lesson." };
const PLAN_ERRORS = { ...COMMON, plan: "Please describe the plan." };

type ReportRow = { id: string; period_start: string; period_end: string; summary: string; setbacks: string | null; assertion_id: string | null };
type OutcomeRow = { id: string; description: string; target: string | null; achieved: string | null; assertion_id: string | null };
type LessonRow = { id: string; lesson: string; recorded_on: string };
type PlanRow = { id: string; plan: string; local_owner: string | null; review_on: string | null };
type PersonRow = { id: string; display_name: string; role_title: string | null };

export default async function EditResults({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const { supabase, project, today, zone } = await loadEditorProject(slug);

  const [assertionsRes, reportsRes, outcomesRes, lessonsRes, plansRes, peopleRes] = await Promise.all([
    supabase.from("assertions").select("id, statement, status").eq("project_id", project.id)
      .order("asserted_on", { ascending: false }),
    supabase.from("progress_reports").select("id, period_start, period_end, summary, setbacks, assertion_id")
      .eq("project_id", project.id).order("period_start"),
    supabase.from("outcomes").select("id, description, target, achieved, assertion_id")
      .eq("project_id", project.id).order("created_at"),
    supabase.from("lessons").select("id, lesson, recorded_on").eq("project_id", project.id).order("recorded_on"),
    supabase.from("sustainability_plans").select("id, plan, local_owner, review_on")
      .eq("project_id", project.id).order("created_at"),
    supabase.from("people").select("id, display_name, role_title").eq("is_beneficiary", false).order("display_name"),
  ]);
  const assertions = (assertionsRes.data ?? []) as AssertionRow[];
  const reports = (reportsRes.data ?? []) as ReportRow[];
  const outcomes = (outcomesRes.data ?? []) as OutcomeRow[];
  const lessons = (lessonsRes.data ?? []) as LessonRow[];
  const plans = (plansRes.data ?? []) as PlanRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const statusOf = new Map(assertions.map((a) => [a.id, a.status]));

  return (
    <main className="passport">
      <Crumbs project={project} here="Reports and results" />
      <h1>Reports and results</h1>
      <p className="small muted">
        What happened, what it achieved, what was learned, and how it will last.
        Everything here is public on the passport, so leave out private details about
        people. Dates are the project&apos;s local dates ({zone}).
      </p>

      <h2>Progress reports</h2>
      {reports.length === 0 ? <p className="muted">No progress reports yet.</p> : (
        <ul className="statement-list">
          {reports.map((r) => (
            <li key={r.id}>
              <strong>{formatDate(r.period_start)} – {formatDate(r.period_end)}</strong> <EntryStatus id={r.assertion_id} statusOf={statusOf} />
              <p>{r.summary}</p>
              {r.setbacks && <p className="muted small">Setbacks: {r.setbacks}</p>}
            </li>
          ))}
        </ul>
      )}
      <h3 id="add-report">Add a progress report</h3>
      <FormMessages added={q.reportAdded} addedText="Progress report recorded." error={q.reportError} errors={REPORT_ERRORS} />
      <form action={addProgressReport} className="editor-form">
        <ProjectFields project={project} />
        <label htmlFor="period_start">Period starts</label>
        <input id="period_start" name="period_start" type="date" max={today} required />
        <label htmlFor="period_end">Period ends</label>
        <input id="period_end" name="period_end" type="date" max={today} required />
        <label htmlFor="summary">What happened in this period</label>
        <textarea id="summary" name="summary" rows={4} maxLength={4000} required />
        <label htmlFor="setbacks">Setbacks (optional)</label>
        <textarea id="setbacks" name="setbacks" rows={3} maxLength={4000} />
        <p className="small muted">
          Setbacks are recorded openly, not hidden. An honest account of what went wrong
          is part of the record.
        </p>
        <PersonSelect id="author_id" name="author_id" label="Written by" people={people} />
        <p className="small muted">Whoever writes a report can&apos;t later verify this project.</p>
        <StatementSelect id="r_assertion_id" assertions={assertions} />
        <button type="submit">Record progress report</button>
      </form>

      <h2>Outcomes</h2>
      {outcomes.length === 0 ? <p className="muted">No outcomes yet.</p> : (
        <ul className="statement-list">
          {outcomes.map((o) => (
            <li key={o.id}>
              <strong>{o.description}</strong> <EntryStatus id={o.assertion_id} statusOf={statusOf} />
              <p className="muted small">Target: {o.target ?? "—"} · Achieved: {o.achieved ?? "—"}</p>
            </li>
          ))}
        </ul>
      )}
      <h3 id="add-outcome">Add an outcome</h3>
      <FormMessages added={q.outcomeAdded} addedText="Outcome recorded." error={q.outcomeError} errors={OUTCOME_ERRORS} />
      <form action={addOutcome} className="editor-form">
        <ProjectFields project={project} />
        <label htmlFor="o_description">Outcome</label>
        <input id="o_description" name="description" type="text" maxLength={300} required placeholder="e.g. Pupils taught indoors in the rainy season" />
        <label htmlFor="measure">How it is measured (optional)</label>
        <input id="measure" name="measure" type="text" maxLength={300} placeholder="e.g. Pupils with a classroom place" />
        <label htmlFor="target">Target (optional)</label>
        <input id="target" name="target" type="text" maxLength={300} placeholder="e.g. 80 pupils" />
        <label htmlFor="achieved">Achieved so far (optional)</label>
        <input id="achieved" name="achieved" type="text" maxLength={300} placeholder="e.g. 76 pupils" />
        <StatementSelect id="o_assertion_id" assertions={assertions} />
        <button type="submit">Record outcome</button>
      </form>

      <h2>Lessons learned</h2>
      {lessons.length === 0 ? <p className="muted">No lessons yet.</p> : (
        <ul className="statement-list">
          {lessons.map((l) => (
            <li key={l.id}>{l.lesson}<p className="muted small">Recorded {formatDate(l.recorded_on)}</p></li>
          ))}
        </ul>
      )}
      <h3 id="add-lesson">Add a lesson</h3>
      <FormMessages added={q.lessonAdded} addedText="Lesson recorded." error={q.lessonError} errors={LESSON_ERRORS} />
      <form action={addLesson} className="editor-form">
        <ProjectFields project={project} />
        <label htmlFor="lesson">Lesson</label>
        <textarea id="lesson" name="lesson" rows={3} maxLength={4000} required />
        <label htmlFor="l_recorded_on">Date recorded</label>
        <input id="l_recorded_on" name="recorded_on" type="date" defaultValue={today} max={today} />
        <button type="submit">Record lesson</button>
      </form>

      <h2>Sustainability</h2>
      {plans.length === 0 ? <p className="muted">No sustainability plan yet.</p> : (
        <ul className="statement-list">
          {plans.map((p) => (
            <li key={p.id}>
              {p.plan}
              <p className="muted small">
                {p.local_owner ? `Local owner: ${p.local_owner}` : "Local owner not recorded"}
                {p.review_on && ` · Review ${formatDate(p.review_on)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <h3 id="add-plan">Add a sustainability plan</h3>
      <FormMessages added={q.planAdded} addedText="Sustainability plan recorded." error={q.planError} errors={PLAN_ERRORS} />
      <form action={addSustainabilityPlan} className="editor-form">
        <ProjectFields project={project} />
        <label htmlFor="plan">How the work will be kept going</label>
        <textarea id="plan" name="plan" rows={3} maxLength={4000} required />
        <label htmlFor="funding_after_grant">How it will be paid for afterwards (optional)</label>
        <textarea id="funding_after_grant" name="funding_after_grant" rows={2} maxLength={4000} />
        <label htmlFor="local_owner">Local owner (optional)</label>
        <input id="local_owner" name="local_owner" type="text" maxLength={300} placeholder="e.g. School parents' committee" />
        <p className="small muted">An organization or role, not a private individual&apos;s name.</p>
        <label htmlFor="review_on">Next review date (optional)</label>
        <input id="review_on" name="review_on" type="date" />
        <button type="submit">Record sustainability plan</button>
      </form>
    </main>
  );
}
