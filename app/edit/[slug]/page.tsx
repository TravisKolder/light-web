import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import type { AssertionStatus } from "@/lib/types";
import { addAssertion, addDocument } from "./actions";

// Editor: a project's statements (backlog items 21b, 21c1). Lists every
// assertion with its status badge and offers forms to add a new one and to
// attach supporting document metadata to one. Status is
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

const DOC_ERRORS: Record<string, string> = {
  project: ERRORS.project,
  assertion: "Please choose one of this project's statements.",
  kind: "Please choose what kind of document it is.",
  title: "Please give the document a title.",
  long: "The title is too long (300 characters at most).",
  person: ERRORS.person,
  date: ERRORS.date,
  future: ERRORS.future,
  save: "The document couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};

const DOCUMENT_KINDS: { value: string; label: string }[] = [
  { value: "receipt", label: "Receipt" },
  { value: "invoice", label: "Invoice" },
  { value: "photo", label: "Photo" },
  { value: "report", label: "Report" },
  { value: "contract", label: "Contract" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "other", label: "Other" },
];

type AssertionRow = {
  id: string;
  statement: string;
  asserted_on: string;
  status: AssertionStatus;
  asserted_by: { display_name: string } | null;
  documents: { count: number }[];
};

type PersonRow = { id: string; display_name: string; role_title: string | null };

export default async function EditProjectStatements({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    added?: string;
    error?: string;
    docAdded?: string;
    docError?: string;
  }>;
}) {
  const session = await getEditorSession();
  if (session.state === "not-configured" || session.state === "not-editor") redirect("/edit");
  if (session.state === "signed-out") redirect("/edit/sign-in");

  const { slug } = await params;
  const { added, error, docAdded, docError } = await searchParams;
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
      .select(
        "id, statement, asserted_on, status, asserted_by:people(display_name), documents(count)",
      )
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
                {" · "}
                {docCount(a)} document{docCount(a) === 1 ? "" : "s"}
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

      <h2 id="add-document">Attach a supporting document</h2>
      <p className="small muted">
        Records the document&apos;s details only; file upload comes later. A document
        moves a claim to <strong>documented</strong>, never to verified.
      </p>
      {docAdded && <p className="sample-banner" role="status">Document recorded.</p>}
      {docError && DOC_ERRORS[docError] && (
        <p className="form-error" role="alert">{DOC_ERRORS[docError]}</p>
      )}
      {assertions.length === 0 ? (
        <p className="muted">Add a statement first; every document supports a statement.</p>
      ) : (
        <form action={addDocument} className="editor-form">
          <input type="hidden" name="slug" value={project.slug} />
          <input type="hidden" name="project_id" value={project.id} />
          <label htmlFor="assertion_id">Supports which statement</label>
          <select id="assertion_id" name="assertion_id" required defaultValue="">
            <option value="" disabled>Choose a statement…</option>
            {assertions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.statement.length > 90 ? `${a.statement.slice(0, 90)}…` : a.statement}
              </option>
            ))}
          </select>
          <label htmlFor="kind">Kind</label>
          <select id="kind" name="kind" required defaultValue="">
            <option value="" disabled>Choose a kind…</option>
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <label htmlFor="doc_title">Title</label>
          <input
            id="doc_title"
            name="title"
            type="text"
            maxLength={300}
            required
            placeholder="e.g. Hardware store invoice for roofing sheets"
          />
          <label htmlFor="issued_on">Date issued (optional)</label>
          <input id="issued_on" name="issued_on" type="date" max={today} />
          <label htmlFor="uploaded_by">Supplied by</label>
          <select id="uploaded_by" name="uploaded_by" defaultValue="">
            <option value="">Not recorded</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}{p.role_title ? ` (${p.role_title})` : ""}
              </option>
            ))}
          </select>
          <p className="small muted">
            Whoever supplies a document can&apos;t later verify this project.
          </p>
          <label className="checkbox">
            <input type="checkbox" name="contains_personal_data" /> Contains personal data
            (names, ID or account numbers, addresses). Its file location will never be
            shown publicly. The kind, title and date are always public, so keep
            personal details out of the title.
          </label>
          <button type="submit">Record document</button>
        </form>
      )}
    </main>
  );
}

function docCount(a: AssertionRow) {
  return a.documents?.[0]?.count ?? 0;
}
