import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for the editor area (backlog item 21a). It carries the
 * signed-in user's session from cookies, so Row Level Security sees them as
 * `authenticated` and the `editors_all` policies apply. Returns null when
 * Supabase isn't configured (local fallback mode).
 *
 * Public pages keep using `getSupabaseClient()` (anon, public_* views only).
 */
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export type EditorSession =
  | { state: "not-configured" }
  | { state: "signed-out" }
  | { state: "not-editor"; userId: string; email: string | null }
  | { state: "editor"; userId: string; email: string | null; displayName: string };

/** Who is looking at the editor area, and are they on `public.editors`? */
export async function getEditorSession(): Promise<EditorSession> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { state: "not-configured" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { state: "signed-out" };

  // RLS: an editor can read the editors table; anyone else gets no rows.
  const { data: editor } = await supabase
    .from("editors")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!editor) return { state: "not-editor", userId: user.id, email: user.email ?? null };
  return {
    state: "editor",
    userId: user.id,
    email: user.email ?? null,
    displayName: editor.display_name as string,
  };
}
