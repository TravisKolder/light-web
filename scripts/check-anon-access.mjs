// Live access audit for signed-out visitors (backlog item 22b).
//
// Uses ONLY the anon key (the one the browser gets) against the real
// Supabase project and checks that:
//   1. every base table refuses reads (permission denied, or no rows at all),
//   2. every public_* view is readable and returns exactly the documented
//      columns (docs/security-policies.md), nothing more,
//   3. the one function that reads base tables as the caller
//      (compute_assertion_status) is refused, and is_editor() says false,
//   4. the private `evidence` storage bucket (migration 019) can't be seen,
//      listed or read through a public URL.
// Read-only: it never inserts, updates or deletes anything.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run check:anon-access
// (or put them in .env.local; the script reads that file if the vars aren't set).
// Without the env vars it prints SKIPPED and exits 0, so it is safe in CI.
import { readFileSync, existsSync } from "node:fs";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.log("SKIPPED: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run the live anon-access check.");
  process.exit(0);
}
if (/service_role|sb_secret_/.test(KEY) || decodeRole(KEY) === "service_role") {
  console.error("Refusing to run: that key is a service/secret key, not the anon key.");
  process.exit(1);
}

function decodeRole(key) {
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
  } catch {
    return undefined;
  }
}

// Every base table. Anon must not read any of them.
const BASE_TABLES = [
  "organizations", "people", "projects", "project_leaders",
  "assertions", "documents", "verifications",
  "budget_lines", "funds_received", "suppliers", "purchases", "payments",
  "evidence_items", "progress_reports", "outcomes", "lessons",
  "sustainability_plans", "kingdom_return_entries", "kingdom_return_links",
  "editors", "audit_log",
];

// Every public view and its exact documented columns
// (migrations 009 and 010; docs/security-policies.md).
const PUBLIC_VIEWS = {
  public_projects: ["id", "slug", "title", "organization_id", "country", "region", "need_statement", "objectives", "status", "start_date", "end_date", "base_currency", "created_at", "timezone", "is_sample"],
  public_organizations: ["id", "name", "country", "region", "description", "website"],
  public_project_leaders: ["project_id", "role", "since", "display_name", "role_title"],
  public_assertions: ["id", "project_id", "statement", "status", "asserted_on", "asserted_by_name", "corrected_at", "correction_reason", "withdrawn_at", "withdrawal_reason"],
  public_budget_lines: ["id", "project_id", "category", "description", "approved_amount", "currency", "exchange_rate", "rate_date", "rate_source", "approved_amount_base", "approved_on", "assertion_id"],
  public_funds_received: ["id", "project_id", "amount", "currency", "exchange_rate", "rate_date", "rate_source", "amount_base", "received_on", "source_category", "assertion_id"],
  public_purchases: ["id", "project_id", "budget_line_id", "supplier_name", "supplier_kind", "supplier_country", "supplier_region", "description", "quantity", "unit", "amount", "currency", "exchange_rate", "rate_date", "rate_source", "amount_base", "purchased_on", "assertion_id"],
  public_payments: ["id", "project_id", "purchase_id", "amount", "currency", "exchange_rate", "rate_date", "rate_source", "amount_base", "paid_on", "method", "assertion_id"],
  public_budget_vs_actual: ["budget_line_id", "project_id", "category", "approved_amount_base", "spent_base", "remaining_base", "assertion_id"],
  public_documents: ["id", "project_id", "assertion_id", "kind", "title", "issued_on", "contains_personal_data", "storage_path"],
  public_verifications: ["id", "project_id", "assertion_id", "verifier_name", "independence_declared_on", "verified_on", "method", "finding", "tie_flagged"],
  public_evidence: ["id", "project_id", "assertion_id", "kind", "caption", "captured_on", "location_label", "storage_path"],
  public_progress_reports: ["id", "project_id", "period_start", "period_end", "summary", "setbacks", "assertion_id", "author_name"],
  public_outcomes: ["id", "project_id", "description", "measure", "target", "achieved", "assertion_id"],
  public_lessons: ["id", "project_id", "lesson", "recorded_on"],
  public_sustainability_plans: ["id", "project_id", "plan", "funding_after_grant", "local_owner", "review_on"],
  public_kingdom_return_entries: ["id", "project_id", "dimension", "narrative", "recorded_on", "author_name"],
  public_kingdom_return_links: ["id", "project_id", "entry_id", "assertion_id", "evidence_item_id"],
};

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/json" };
const rest = (path, init) => fetch(`${URL_.replace(/\/$/, "")}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init?.headers } });

const failures = [];
const notes = [];

for (const t of BASE_TABLES) {
  const res = await rest(`${t}?select=*&limit=1`);
  const body = await res.json().catch(() => null);
  if (res.ok && Array.isArray(body) && body.length > 0) {
    failures.push(`${t}: anon can READ rows from this base table`);
  } else if (res.ok) {
    notes.push(`${t}: no rows returned (expected a permission error; check the grants in migration 013)`);
  } else {
    console.log(`ok   ${t}: refused (${res.status}${body?.code ? ` ${body.code}` : ""})`);
  }
}

for (const [view, expected] of Object.entries(PUBLIC_VIEWS)) {
  const res = await rest(`${view}?select=*&limit=1`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    failures.push(`${view}: not readable by anon (${res.status} ${body?.message ?? ""})`);
    continue;
  }
  if (!body?.length) {
    notes.push(`${view}: readable but empty, so its columns weren't checked`);
    continue;
  }
  const got = Object.keys(body[0]);
  const extra = got.filter((c) => !expected.includes(c));
  const missing = expected.filter((c) => !got.includes(c));
  if (extra.length) failures.push(`${view}: UNDOCUMENTED columns exposed: ${extra.join(", ")}`);
  if (missing.length) notes.push(`${view}: documented columns missing: ${missing.join(", ")} (update the doc or the view)`);
  if (!extra.length) console.log(`ok   ${view}: ${got.length} columns, all documented`);
}

// Functions callable over /rpc.
{
  const res = await rest("rpc/compute_assertion_status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_assertion_id: "00000000-0000-0000-0000-000000000000" }),
  });
  if (res.ok) failures.push("rpc/compute_assertion_status: anon can call it (expected permission denied on base tables)");
  else console.log(`ok   rpc/compute_assertion_status: refused (${res.status})`);
}
{
  const res = await rest("rpc/is_editor", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const body = await res.json().catch(() => null);
  if (res.ok && body === false) console.log("ok   rpc/is_editor: false for anon");
  else if (res.ok) failures.push(`rpc/is_editor: returned ${JSON.stringify(body)} for anon`);
  else notes.push(`rpc/is_editor: refused (${res.status}); harmless, but the policies expect it callable`);
}

// Storage (migration 019): the private `evidence` bucket. Anon must not see
// the bucket, list its files, or reach a file through a public URL.
{
  const storage = (path, init) => fetch(`${URL_.replace(/\/$/, "")}/storage/v1/${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  const bucket = await storage("bucket/evidence");
  const bucketBody = await bucket.json().catch(() => null);
  if (bucket.ok && bucketBody?.id) failures.push("storage bucket/evidence: anon can read the bucket's settings");
  else console.log(`ok   storage bucket/evidence: hidden from anon (${bucket.status})`);

  const list = await storage("object/list/evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 100 }),
  });
  const listBody = await list.json().catch(() => null);
  if (list.ok && Array.isArray(listBody) && listBody.length > 0) failures.push(`storage evidence: anon can LIST ${listBody.length} file(s)/folder(s)`);
  else console.log(`ok   storage evidence: listing gives anon nothing (${list.status})`);

  const pub = await storage("object/public/evidence/light-web-anon-probe.pdf");
  if (pub.ok) failures.push("storage evidence: a public URL served a file (bucket must be private)");
  else console.log(`ok   storage evidence: no public URLs (${pub.status})`);
}

for (const n of notes) console.log(`note ${n}`);
if (failures.length) {
  console.error("\nFAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`\nOK: ${BASE_TABLES.length} base tables refused, ${Object.keys(PUBLIC_VIEWS).length} public views checked.`);
}
