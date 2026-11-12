import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEditorSession } from "@/lib/supabase/server";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Editor sign-in — Light Web" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  email: "Please enter a valid email address.",
  send: "The sign-in link couldn't be sent. Please try again in a minute.",
  link: "That sign-in link has expired or was already used. Request a new one.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const session = await getEditorSession();
  if (session.state === "not-configured" || session.state === "editor") redirect("/edit");
  const { sent, error } = await searchParams;

  return (
    <main className="passport">
      <p className="crumbs"><Link href="/">Light Web</Link> / Editor sign-in</p>
      <h1>Editor sign-in</h1>
      <p className="muted">
        For the people who keep Project Passports up to date. We&apos;ll email you a
        one-time sign-in link; there is no password.
      </p>
      {sent ? (
        <p className="sample-banner" role="status">
          Check your email for a sign-in link. It works once and expires soon.
        </p>
      ) : (
        <form action={signIn} className="editor-form">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <button type="submit">Email me a sign-in link</button>
        </form>
      )}
      {error && ERRORS[error] && <p className="form-error" role="alert">{ERRORS[error]}</p>}
    </main>
  );
}
