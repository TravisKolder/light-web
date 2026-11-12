"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Server actions for editor sign-in (backlog item 21a).

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/edit/sign-in?error=email");

  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/edit");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${proto}://${host}/auth/callback` },
  });
  // Same message either way, so the form doesn't reveal who has an account.
  redirect(error ? "/edit/sign-in?error=send" : "/edit/sign-in?sent=1");
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/edit/sign-in");
}
