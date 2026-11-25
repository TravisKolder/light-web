import "server-only";
import { createClient } from "@supabase/supabase-js";
import { EVIDENCE_BUCKET } from "@/lib/upload-limits";

// Server-only signer for PUBLIC passport files (backlog 27d2).
//
// The `evidence` bucket stays editors-only in storage RLS (migration 019), so
// the anon key can't sign anything. This module holds the one server-side
// key that can, and does exactly one thing with it: sign a 60-second URL for
// a path the caller has ALREADY re-checked through the public views with the
// anon key. It is never imported by a client component, and the key is not a
// NEXT_PUBLIC_ variable, so it never reaches the browser
// (scripts/check-build-output.mjs scans for it).
//
// Optional: without SUPABASE_SERVICE_ROLE_KEY the public page simply shows
// no file links.
const SIGNED_URL_SECONDS = 60;

export function canSignPublicFiles(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function signPublicFile(storagePath: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.storage.from(EVIDENCE_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}
