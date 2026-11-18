import type { Metadata } from "next";
import Link from "next/link";
import { Crumbs, loadEditorProject } from "../page-helpers";

// Editor: the project's change history (backlog item 26a), read from the
// append-only audit_log. Editors only: old/new values include PRIVATE
// columns, so nothing here may ever feed a public page.

export const metadata: Metadata = { title: "Change history — Light Web" };
export const dynamic = "force-dynamic";

const LIMIT = 200;

/** Kinds of record an editor can filter by, and the tables behind each. */
const KINDS = [
  { key: "statements", label: "Statements, documents, verifications", tables: ["assertions", "documents", "verifications"] },
  { key: "money", label: "Budget, funds, purchases, payments", tables: ["budget_lines", "funds_received", "suppliers", "purchases", "payments"] },
  { key: "results", label: "Evidence, reports, results", tables: ["evidence_items", "progress_reports", "outcomes", "lessons", "sustainability_plans"] },
  { key: "kingdom", label: "Kingdom Return", tables: ["kingdom_return_entries", "kingdom_return_links"] },
  { key: "project", label: "Project and leaders", tables: ["projects", "project_leaders"] },
] as const;

const TABLE_LABEL: Record<string, string> = {
  assertions: "Statement", documents: "Document", verifications: "Verification",
  budget_lines: "Budget line", funds_received: "Funds received", suppliers: "Supplier",
  purchases: "Purchase", payments: "Payment", evidence_items: "Evidence item",
  progress_reports: "Progress report", outcomes: "Outcome", lessons: "Lesson",
  sustainability_plans: "Sustainability plan", kingdom_return_entries: "Kingdom Return entry",
  kingdom_return_links: "Kingdom Return link", projects: "Project", project_leaders: "Project leader",
};

const ACTION_LABEL = { INSERT: "Added", UPDATE: "Changed", DELETE: "Removed" } as const;

// Bookkeeping columns that change on every edit and say nothing to a reader.
const SKIP = new Set(["updated_at", "created_at"]);
// Columns that best name a record, in order of preference.
const NAME_KEYS = ["statement", "title", "description", "caption", "summary", "name", "narrative", "lesson", "plan", "status"];

type Row = {
  id: number; occurred_at: string; actor_id: string | null; actor_role: string;
  table_name: string; action: keyof typeof ACTION_LABEL; row_id: string | null;
  old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null;
};

const short = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);
const show = (v: unknown) =>
  v === null || v === undefined || v === "" ? "(empty)" : short(typeof v === "string" ? v : JSON.stringify(v));

function recordName(r: Record<string, unknown> | null): string | null {
  if (!r) return null;
  for (const k of NAME_KEYS) if (typeof r[k] === "string" && r[k]) return short(r[k] as string, 100);
  return null;
}

function changes(o: Record<string, unknown>, n: Record<string, unknown>) {
  return Object.keys({ ...o, ...n })
    .filter((k) => !SKIP.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
    .map((k) => ({ field: k.replace(/_/g, " "), from: show(o[k]), to: show(n[k]) }));
}

function whenIn(zone: string | undefined) {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone: zone || "UTC", dateStyle: "medium", timeStyle: "short" });
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  }
  return (iso: string) => fmt.format(new Date(iso));
}

export default async function ProjectHistory({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { slug } = await params;
  const { kind } = await searchParams;
  const { supabase, project, zone } = await loadEditorProject(slug);
  const chosen = KINDS.find((k) => k.key === kind);
  const tables: readonly string[] = chosen ? chosen.tables : KINDS.flatMap((k) => k.tables);

  // Documents and verifications carry no project_id, so the log rows for
  // them are found by the ids of this project's current ones.
  const wantStatementParts = tables.includes("documents") || tables.includes("verifications");
  const { data: assertionIds } = wantStatementParts
    ? await supabase.from("assertions").select("id").eq("project_id", project.id)
    : { data: [] as { id: string }[] };
  const aIds = (assertionIds ?? []).map((a) => a.id);
  const [docsRes, verRes] = aIds.length
    ? await Promise.all([
        supabase.from("documents").select("id").in("assertion_id", aIds),
        supabase.from("verifications").select("id").in("assertion_id", aIds),
      ])
    : [{ data: [] }, { data: [] }];
  const partIds = [...(docsRes.data ?? []), ...(verRes.data ?? [])].map((r: { id: string }) => r.id);

  const cols = "id, occurred_at, actor_id, actor_role, table_name, action, row_id, old_row, new_row";
  const queries = [
    supabase.from("audit_log").select(cols).eq("project_id", project.id).in("table_name", [...tables])
      .order("occurred_at", { ascending: false }).limit(LIMIT),
  ];
  if (wantStatementParts && partIds.length) {
    queries.push(
      supabase.from("audit_log").select(cols)
        .in("table_name", ["documents", "verifications"].filter((t) => tables.includes(t)))
        .in("row_id", partIds).order("occurred_at", { ascending: false }).limit(LIMIT),
    );
  }
  const [results, editorsRes] = await Promise.all([
    Promise.all(queries),
    supabase.from("editors").select("user_id, display_name"),
  ]);
  const failed = results.some((r) => r.error);
  const byId = new Map<number, Row>();
  for (const r of results) for (const row of (r.data ?? []) as Row[]) byId.set(row.id, row);
  const rows = [...byId.values()]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id - a.id)
    .slice(0, LIMIT);

  const editorName = new Map((editorsRes.data ?? []).map((e) => [e.user_id as string, e.display_name as string]));
  const who = (r: Row) =>
    r.actor_id ? editorName.get(r.actor_id) ?? "A former editor" : `System (${r.actor_role})`;
  const when = whenIn(project.timezone);
  const base = `/edit/${project.slug}/history`;

  return (
    <main className="passport">
      <Crumbs project={project} here="History" />
      <h1>Change history</h1>
      <p className="small muted">
        Every addition, change and removal on this project, newest first, from the
        append-only log. Nothing here can be edited or erased. <strong>Editors only</strong>:
        old and new values can include private details. Times are {zone}.
      </p>

      <p className="button-row small" aria-label="Filter by kind of record">
        {chosen ? <Link href={base}>All records</Link> : <strong>All records</strong>}
        {KINDS.map((k) =>
          k.key === chosen?.key
            ? <strong key={k.key}>{k.label}</strong>
            : <Link key={k.key} href={`${base}?kind=${k.key}`}>{k.label}</Link>,
        )}
      </p>

      {failed && <p className="form-error" role="alert">Part of the history couldn&apos;t be loaded. Reload the page; if it keeps failing, tell Travis.</p>}

      {rows.length === 0 ? (
        <p className="muted">No changes recorded{chosen ? " for this kind of record" : ""} yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = recordName(r.new_row) ?? recordName(r.old_row);
                const diff = r.action === "UPDATE" && r.old_row && r.new_row ? changes(r.old_row, r.new_row) : [];
                return (
                  <tr key={r.id}>
                    <td>{when(r.occurred_at)}</td>
                    <td>{who(r)}</td>
                    <td>
                      {ACTION_LABEL[r.action]} {(TABLE_LABEL[r.table_name] ?? r.table_name).toLowerCase()}
                      {name && <div className="small muted">{name}</div>}
                    </td>
                    <td className="small">
                      {diff.length > 0 ? (
                        <ul className="objectives">
                          {diff.map((d) => <li key={d.field}><strong>{d.field}</strong>: {d.from} → {d.to}</li>)}
                        </ul>
                      ) : r.action === "UPDATE" ? "Only bookkeeping fields changed" : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === LIMIT && <p className="small muted">Showing the latest {LIMIT} changes. Pick a kind of record above to see further back.</p>}
      <p className="small muted">
        Not shown here: changes to people and organizations (they aren&apos;t tied to one
        project), and documents or verifications that have since been removed.
      </p>
    </main>
  );
}
