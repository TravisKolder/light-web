import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client using the public anon key, or null when the
 * env vars are not configured (so the app still builds and renders).
 * Row Level Security in Supabase is what protects private fields — the
 * anon key must only ever see public data.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
