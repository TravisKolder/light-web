import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Magic-link landing (backlog item 21a): swap the one-time code for a session
// cookie, then go to the editor area.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const supabase = await getSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/edit", origin));
  }
  return NextResponse.redirect(new URL("/edit/sign-in?error=link", origin));
}
