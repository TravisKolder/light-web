import { NextResponse } from "next/server";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { EVIDENCE_BUCKET } from "@/lib/upload-limits";

// Editor-only file viewer (backlog 27d1). Re-checks the editor session and
// that the row belongs to this project, then signs a 60-second URL with the
// editor's own session (bucket policies apply) and redirects to it. The
// stored path never reaches the page; the signed URL is not cached and not
// sent on as a referrer.
const TABLES = { documents: "documents", evidence: "evidence_items" } as const;
const SIGNED_URL_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function noFile(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; kind: string; id: string }> },
) {
  const { slug, kind, id } = await params;
  const table = TABLES[kind as keyof typeof TABLES];
  if (!table || !UUID.test(id)) return noFile(404, "File not found.");

  const session = await getEditorSession();
  if (session.state !== "editor") return noFile(403, "Editors only. Please sign in.");
  const supabase = (await getSupabaseServerClient())!;

  // Join through the statement to the project, so a link only works under
  // the project it belongs to.
  const { data: row } = await supabase
    .from(table)
    .select("storage_path, assertion:assertions!inner(project:projects!inner(slug))")
    .eq("id", id)
    .eq("assertion.project.slug", slug)
    .maybeSingle<{ storage_path: string | null }>();
  if (!row?.storage_path) return noFile(404, "File not found.");

  const { data: signed, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
  if (error || !signed?.signedUrl) return noFile(502, "Couldn't open the file. Please try again.");

  const res = NextResponse.redirect(signed.signedUrl, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
