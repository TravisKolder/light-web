import { getSupabaseClient } from "@/lib/supabase/client";
import { signPublicFile } from "@/lib/supabase/file-signer";

// Public file route (backlog 27d2). Serves a file only if the PUBLIC views
// still expose it right now: the row is looked up again with the anon key in
// public_documents / public_evidence (which already drop documents with
// personal data and photos of identifiable people), and must belong to the
// public project with this slug. Sample projects have no real files.
//
// The file is then signed for 60 seconds and streamed through this route, so
// neither the storage path nor the signed URL ever reaches the browser (and
// the page's img-src 'self' CSP needs no Supabase host).
const VIEWS = { documents: "public_documents", evidence: "public_evidence" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVABLE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function noFile(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; kind: string; id: string }> },
) {
  const { slug, kind, id } = await params;
  const view = VIEWS[kind as keyof typeof VIEWS];
  if (!view || !UUID.test(id)) return noFile(404, "File not found.");

  const supabase = getSupabaseClient();
  if (!supabase) return noFile(404, "File not found.");

  const { data: project } = await supabase
    .from("public_projects")
    .select("id, is_sample")
    .eq("slug", slug)
    .maybeSingle<{ id: string; is_sample: boolean | null }>();
  if (!project || project.is_sample) return noFile(404, "File not found.");

  const { data: row } = await supabase
    .from(view)
    .select("storage_path")
    .eq("id", id)
    .eq("project_id", project.id)
    .maybeSingle<{ storage_path: string | null }>();
  if (!row?.storage_path) return noFile(404, "File not found.");

  const signed = await signPublicFile(row.storage_path);
  if (!signed) return noFile(503, "This file isn't available right now.");

  const upstream = await fetch(signed, { cache: "no-store" });
  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!upstream.ok || !upstream.body || !SERVABLE.has(type)) {
    return noFile(502, "Couldn't load the file. Please try again.");
  }

  const headers = new Headers({
    "Content-Type": type,
    // Short and private: if the item is hidden later, browsers stop showing
    // it within minutes and no shared cache keeps a copy.
    "Cache-Control": "private, max-age=300",
    "Content-Disposition": "inline",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { status: 200, headers });
}
