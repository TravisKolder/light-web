import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Editor area home (backlog item 21a). Only users listed in public.editors
// get past this page; RLS enforces the same rule in the database.

export const metadata: Metadata = { title: "Editor — Light Web" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = { planned: "Planned", active: "Active", completed: "Completed", paused: "Paused" } as const;

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  status: keyof typeof STATUS_LABEL;
  visibility: "private" | "public";
};

export default async function EditorHome() {
  const session = await getEditorSession();

  if (session.state === "not-configured") {
    return (
      <main className="passport">
        <p className="crumbs"><Link href="/">Light Web</Link> / Editor</p>
        <h1>Editor</h1>
        <p className="sample-banner" role="note">
          Supabase isn&apos;t configured, so the site is showing fictional sample data
          and editing is turned off. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> (see{" "}
          <code>.env.example</code>) to sign in and edit.
        </p>
      </main>
    );
  }

  if (session.state === "signed-out") redirect("/edit/sign-in");

  const signOutForm = (
    <form action={signOut} className="inline-form">
      <button type="submit" className="link-button">Sign out</button>
    </form>
  );

  if (session.state === "not-editor") {
    return (
      <main className="passport">
        <p className="crumbs"><Link href="/">Light Web</Link> / Editor</p>
        <h1>Not an editor yet</h1>
        <p>
          You&apos;re signed in{session.email ? ` as ${session.email}` : ""}, but this account
          isn&apos;t on the editors list. During the pilot, editors are added by hand.
          Send this user id to Travis so he can add you:
        </p>
        <p><code>{session.userId}</code></p>
        {signOutForm}
      </main>
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase!
    .from("projects")
    .select("id, slug, title, status, visibility")
    .order("title");
  const projects = (data ?? []) as ProjectRow[];

  return (
    <main className="passport">
      <p className="crumbs"><Link href="/">Light Web</Link> / Editor</p>
      <h1>Editor</h1>
      <p className="muted">Signed in as {session.displayName}. {signOutForm}</p>
      <p className="small muted">
        Forms record what happened. The database decides whether each statement is a
        claim, documented, or verified; nobody sets that by hand.
      </p>
      <h2>Projects</h2>
      {error ? (
        <p className="form-error" role="alert">Couldn&apos;t load projects: {error.message}</p>
      ) : projects.length === 0 ? (
        <p className="muted">No projects yet.</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/edit/${p.slug}`} className="project-title">{p.title}</Link>
              <p className="muted small">
                {STATUS_LABEL[p.status]} · {p.visibility === "public" ? "Public" : "Private (not on the public site)"}
                {p.visibility === "public" && <> · <Link href={`/p/${p.slug}`}>View public Passport</Link></>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
