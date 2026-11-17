import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { timeZoneLabel, todayInTimeZone } from "@/lib/format";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import type { AssertionStatus } from "@/lib/types";

// Common start of every editor page: only signed-in editors get past here.

export type EditorProject = {
  id: string; slug: string; title: string; base_currency: string;
  organization_id: string; timezone?: string;
};

export async function loadEditorProject(slug: string) {
  const session = await getEditorSession();
  if (session.state === "not-configured" || session.state === "not-editor") redirect("/edit");
  if (session.state === "signed-out") redirect("/edit/sign-in");

  const supabase = (await getSupabaseServerClient())!;
  const { data: project } = await supabase
    .from("projects").select("*").eq("slug", slug).maybeSingle<EditorProject>();
  if (!project) notFound();

  return {
    supabase,
    project,
    today: todayInTimeZone(project.timezone),
    zone: timeZoneLabel(project.timezone),
  };
}

export function Crumbs({ project, here }: { project: EditorProject; here: string }) {
  return (
    <p className="crumbs">
      <Link href="/">Light Web</Link> / <Link href="/edit">Editor</Link> /{" "}
      <Link href={`/edit/${project.slug}`}>{project.title}</Link> / {here}
    </p>
  );
}

/** Success banner and plain-language error for one form. */
export function FormMessages({
  added, addedText, error, errors,
}: { added?: string; addedText: string; error?: string; errors: Record<string, string> }) {
  return (
    <>
      {added && <p className="sample-banner" role="status">{addedText}</p>}
      {error && errors[error] && <p className="form-error" role="alert">{errors[error]}</p>}
    </>
  );
}

export function PersonSelect({
  id, name, label, people, empty = "Not recorded",
}: { id: string; name: string; label: string; people: { id: string; display_name: string; role_title: string | null }[]; empty?: string }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue="">
        <option value="">{empty}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}{p.role_title ? ` (${p.role_title})` : ""}
          </option>
        ))}
      </select>
    </>
  );
}

/** Hidden fields every editor form sends; the action re-checks both. */
export function ProjectFields({ project }: { project: EditorProject }) {
  return (
    <>
      <input type="hidden" name="slug" value={project.slug} />
      <input type="hidden" name="project_id" value={project.id} />
    </>
  );
}

/** The status of the statement an entry is linked to (read-only). */
export function EntryStatus({ id, statusOf }: { id: string | null; statusOf: Map<string, AssertionStatus> }) {
  const s = id ? statusOf.get(id) : undefined;
  return s ? <StatusBadge status={s} /> : <span className="status-badge status-none">– No statement</span>;
}
