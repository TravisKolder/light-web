import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NeedsReviewBadge, StatusBadge } from "@/app/components/StatusBadge";
import { formatDate, timeZoneLabel, todayInTimeZone } from "@/lib/format";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import type { AssertionRow } from "../form-parts";
import { addVerification } from "./actions";

// Editor: record an independent verification (backlog item 21f). The page
// records what a verifier reported. It never sets a status: the database
// moves a statement to "verified" only for a confirmed verification by
// someone with no tie to the project.

export const metadata: Metadata = { title: "Record a verification — Light Web" };
export const dynamic = "force-dynamic";

const TIE_INTRO = "This person can't verify this project, because they ";
const ERRORS: Record<string, string> = {
  project: "That project couldn't be found. Go back to the editor home and try again.",
  assertion: "Please choose one of this project's statements.",
  verifier: "Please choose the verifier from the list, or add a new one by name.",
  verifierBoth: "Choose a verifier from the list or add a new one, not both.",
  declaration: "Please enter the verifier's independence declaration.",
  notConfirmed: "Please confirm that the verifier made this declaration themselves.",
  date: "Please enter valid dates.",
  order: "The declaration must be dated on or before the day of the verification.",
  future: "The verification date can't be in the future.",
  method: "Please choose how it was verified.",
  finding: "Please choose what the verifier found.",
  long: "One of the text boxes is too long.",
  save: "The verification couldn't be saved. Please try again; if it keeps failing, tell Travis.",
  tie: "This person can't verify this project, because they already have a role in it. A verifier must have no ties to the project.",
  tieBeneficiary: TIE_INTRO + "are recorded as a beneficiary.",
  tieLeader: TIE_INTRO + "are listed as one of its leaders.",
  tieStatement: TIE_INTRO + "made one of its statements.",
  tieDocument: TIE_INTRO + "supplied one of its documents.",
  tieEvidence: TIE_INTRO + "supplied some of its evidence.",
  tieGiver: TIE_INTRO + "gave funds to it.",
  tieSupplier: TIE_INTRO + "are the contact for one of its suppliers.",
  tieReport: TIE_INTRO + "wrote one of its progress reports.",
  tieKingdomReturn: TIE_INTRO + "wrote one of its Kingdom Return entries.",
};
const ADDED: Record<string, string> = {
  confirmed: "Verification recorded. If the verifier is independent, the statement now shows as verified.",
  not_confirmed: "Verification recorded as not confirmed. The statement's status does not change.",
  disputed: "Verification recorded as disputed. The statement's status does not change.",
};

const METHOD_LABEL = {
  site_visit: "Site visit", document_review: "Document review", third_party_audit: "Third-party audit",
  photo_geolocation: "Photo geolocation", interview: "Interview", other: "Other",
};
const FINDING_LABEL = { confirmed: "Confirmed", not_confirmed: "Not confirmed", disputed: "Disputed" };

type VerificationRow = {
  id: string; assertion_id: string; verified_on: string; tie_flagged: boolean;
  method: keyof typeof METHOD_LABEL; finding: keyof typeof FINDING_LABEL;
  verifier: { display_name: string } | null;
};
type PersonRow = { id: string; display_name: string; role_title: string | null };

export default async function EditVerifications({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ added?: string; error?: string }>;
}) {
  const session = await getEditorSession();
  if (session.state === "not-configured" || session.state === "not-editor") redirect("/edit");
  if (session.state === "signed-out") redirect("/edit/sign-in");

  const { slug } = await params;
  const { added, error } = await searchParams;
  const supabase = (await getSupabaseServerClient())!;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<{ id: string; slug: string; title: string; timezone?: string }>();
  if (!project) notFound();

  const { data: assertionData } = await supabase
    .from("assertions").select("id, statement, status").eq("project_id", project.id)
    .order("asserted_on", { ascending: false });
  const assertions = (assertionData ?? []) as AssertionRow[];

  const [verificationsRes, peopleRes] = await Promise.all([
    assertions.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("verifications")
          .select("id, assertion_id, verified_on, method, finding, tie_flagged, verifier:people(display_name)")
          .in("assertion_id", assertions.map((a) => a.id))
          .order("verified_on", { ascending: false }),
    // Beneficiaries can never verify, so they aren't offered.
    supabase.from("people").select("id, display_name, role_title").eq("is_beneficiary", false).order("display_name"),
  ]);
  const verifications = (verificationsRes.data ?? []) as unknown as VerificationRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const byId = new Map(assertions.map((a) => [a.id, a]));
  const today = todayInTimeZone(project.timezone);

  return (
    <main className="passport">
      <p className="crumbs">
        <Link href="/">Light Web</Link> / <Link href="/edit">Editor</Link> /{" "}
        <Link href={`/edit/${project.slug}`}>{project.title}</Link> / Verification
      </p>
      <h1>Independent verification</h1>
      <p className="small muted">
        A verification is a check by someone with <strong>no ties to the project</strong>.
        This page records what the verifier reported; it doesn&apos;t decide whether a
        statement is true, and it can&apos;t set a status. The database marks a statement
        verified only when an independent verifier confirms it, and it refuses anyone
        who already has a role in the project. Dates are the project&apos;s local dates
        ({timeZoneLabel(project.timezone)}).
      </p>

      <h2>Verifications recorded</h2>
      {verificationsRes.error ? (
        <p className="form-error" role="alert">Couldn&apos;t load verifications.</p>
      ) : verifications.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className="statement-list">
          {verifications.map((v) => {
            const a = byId.get(v.assertion_id);
            return (
              <li key={v.id}>
                {a && <StatusBadge status={a.status} />} {a?.statement}
                <p className="muted small">
                  <strong>{FINDING_LABEL[v.finding]}</strong> by {v.verifier?.display_name ?? "verifier"} ·{" "}
                  {METHOD_LABEL[v.method].toLowerCase()} · {formatDate(v.verified_on)}
                  {v.tie_flagged && <> <NeedsReviewBadge /></>}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <h2 id="add-verification">Record a verification</h2>
      {added && ADDED[added] && <p className="sample-banner" role="status">{ADDED[added]}</p>}
      {error && ERRORS[error] && <p className="form-error" role="alert">{ERRORS[error]}</p>}
      {assertions.length === 0 ? (
        <p className="muted">Add a statement first; a verification checks a statement.</p>
      ) : (
        <form action={addVerification} className="editor-form">
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="project_id" value={project.id} />
          <label htmlFor="assertion_id">Statement that was checked</label>
          <select id="assertion_id" name="assertion_id" required defaultValue="">
            <option value="" disabled>Choose a statement…</option>
            {assertions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.statement.length > 90 ? `${a.statement.slice(0, 90)}…` : a.statement}
              </option>
            ))}
          </select>

          <fieldset className="gps">
            <legend>Verifier</legend>
            <p className="small muted">
              Must have no family, financial or working ties to the project or its
              organization. Anyone who leads the project, made a statement, supplied a
              document or evidence, gave funds, supplies it, or wrote a report will be
              refused.
            </p>
            <label htmlFor="verifier_id">Choose the verifier</label>
            <select id="verifier_id" name="verifier_id" defaultValue="">
              <option value="">Not in the list</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}{p.role_title ? ` (${p.role_title})` : ""}
                </option>
              ))}
            </select>
            <label htmlFor="new_verifier_name">Or add a new verifier: name as it may be shown</label>
            <input id="new_verifier_name" name="new_verifier_name" type="text" maxLength={120} autoComplete="off" placeholder="e.g. Ruth N." />
            <label htmlFor="new_verifier_role">Their role (optional)</label>
            <input id="new_verifier_role" name="new_verifier_role" type="text" maxLength={120} autoComplete="off" placeholder="e.g. Independent building inspector" />
            <label className="checkbox">
              <input type="checkbox" name="new_verifier_public" /> Show this new verifier&apos;s
              name publicly. Leave unticked unless they have agreed; otherwise the
              passport says &ldquo;an independent verifier (name not public)&rdquo;.
            </label>
          </fieldset>

          <label htmlFor="independence_declaration">Independence declaration, in the verifier&apos;s own words</label>
          <textarea
            id="independence_declaration" name="independence_declaration" rows={3} maxLength={2000} required
            placeholder="e.g. I have no family, financial or working relationship with this project or the people running it."
          />
          <p className="small muted">Kept on record; not shown publicly. Only its date is public.</p>
          <label className="checkbox">
            <input type="checkbox" name="declaration_confirmed" required /> The verifier made
            this declaration themselves, and I am recording it as they gave it.
          </label>
          <label htmlFor="independence_declared_on">Date of the declaration</label>
          <input id="independence_declared_on" name="independence_declared_on" type="date" max={today} required />
          <label htmlFor="verified_on">Date of the verification</label>
          <input id="verified_on" name="verified_on" type="date" max={today} required />
          <label htmlFor="method">How it was verified</label>
          <select id="method" name="method" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label htmlFor="finding">What the verifier found</label>
          <select id="finding" name="finding" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {Object.entries(FINDING_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <p className="small muted">
            Only &ldquo;Confirmed&rdquo; moves a statement to verified. &ldquo;Not
            confirmed&rdquo; and &ldquo;Disputed&rdquo; are recorded and shown, and the
            status stays as it is.
          </p>
          <label htmlFor="notes">Verifier&apos;s notes (optional, private)</label>
          <textarea id="notes" name="notes" rows={3} maxLength={4000} />
          <button type="submit">Record verification</button>
        </form>
      )}
    </main>
  );
}
