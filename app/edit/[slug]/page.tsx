import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import type { AssertionStatus } from "@/lib/types";
import { addAssertion } from "./actions";

// Editor: a project's statements (backlog item 21b). Lists every assertion
// with its status badge and offers a form to add a new one. Status is
// read-only here; the database sets it from documents and verifications.

export const metadata: Metadata = { title: "Edit statements — Light Web" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  project: "That project couldn't be found. Go back to the editor home and try again.",
  statement: "Please write the statement.",
  long: "The statement is too long (2,000 characters at most).",
  person: "Please choose a person from the list.",
  date: "Please enter a valid date.",
  future: "The date can't be in the future.",
  save: "The statement couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};

type AssertionRow = {
  id: string;
  statement: string;
  asserted_on: string;
  status: AssertionStatus;
  asserted_by: { display_name: string } | null;
};

type PersonRow = { id: string; display_name: string; role_title: string | null };

export default async function EditProjectStatements({
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
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) notFound();

  const [assertionsRes, peopleRes] = await Promise.all([
    supabase
      .from("assertions")
      .select("id, statement, asserted_on, status, asserted_by:people(display_name)")
      .eq("project_id", project.id)
      .order("asserted_on", { ascending: false })
      .order("created_at", { ascending: false }),
    // Beneficiaries aren't offered as the person making a statement.
    supabase
      .from("people")
      .select("id, display_name, role_title")
      .eq("is_beneficiary", false)
      .order("display_name"),
  ]);
  const assertions = (assertionsRes.data ?? []) as unknown as AssertionRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="passport">
      <p className="crumbs">
        <Link href="/">Light Web</Link> / <Link href="/edit">Editor</Link> / {project.title}
      </p>
      <h1>{project.title}</h1>
      <h2>Statements</h2>
      <p className="small muted">
        Every statement starts as a <strong>claim</strong>. It becomes{" "}
        <strong>documented</strong> when a supporting document is attached, and{" "}
        <strong>verified</strong> only when an independent verifier confirms it. The
        database sets these; they can&apos;t be changed by hand.
      </p>

      {assertionsRes.error ? (
        <p className="form-error" role="alert">Couldn&apos;t load statements: {assertionsRes.error.message}</p>
      ) : assertions.length === 0 ? (
        <p className="muted">No statements yet.</p>
      ) : (
        <ul className="statement-list">
          {assertions.map((a) => (
            <li key={a.id}>
              <StatusBadge status={a.status} /> {a.statement}
              <p className="muted small">
                {a.asserted_by?.display_name ?? "Person not recorded"} · {a.asserted_on}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 id="add">Add a statement</h2>
      {added && <p className="sample-banner" role="status">Statement added as a claim.</p>}
      {error && ERRORS[error] && <p className="form-error" role="alert">{ERRORS[error]}</p>}
      <form action={addAssertion} className="editor-form">
        <input type="hidden" name="slug" value={project.slug} />
        <input type="hidden" name="project_id" value={project.id} />
        <label htmlFor="statement">Statement</label>
        <textarea
          id="statement"
          name="statement"
          rows={3}
          maxLength={2000}
          required
          placeholder="e.g. The roof of the second classroom was completed in March."
        />
        <label htmlFor="asserted_by">Asserted by</label>
        <select id="asserted_by" name="asserted_by" defaultValue="">
          <option value="">Not recorded</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}{p.role_title ? ` (${p.role_title})` : ""}
            </option>
          ))}
        </select>
        <label htmlFor="asserted_on">Date stated</label>
        <input id="asserted_on" name="asserted_on" type="date" defaultValue={today} max={today} />
        <button type="submit">Add as a claim</button>
      </form>
    </main>
  );
}
