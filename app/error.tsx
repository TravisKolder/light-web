"use client";

import Link from "next/link";

// Shown when a page fails to render. Error details stay in the server log;
// only Next's opaque digest is shown so it can be matched to that log.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-message">
      <p className="crumbs"><Link href="/">Light Web</Link></p>
      <h1>Something went wrong</h1>
      <p className="muted">
        This page couldn&apos;t be loaded. Please try again; if it keeps happening, let
        Travis know{error.digest ? ` and quote reference ${error.digest}` : ""}.
      </p>
      <p className="actions">
        <button type="button" className="link-button" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/p">Browse Project Passports</Link>
      </p>
    </main>
  );
}
