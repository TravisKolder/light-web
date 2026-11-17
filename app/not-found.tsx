import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found — Light Web" };

export default function NotFound() {
  return (
    <main className="page-message">
      <p className="crumbs"><Link href="/">Light Web</Link></p>
      <h1>Page not found</h1>
      <p className="muted">
        There&apos;s no page at this address. It may have moved, or the link may be
        mistyped.
      </p>
      <p className="actions">
        <Link href="/p">Browse Project Passports</Link>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
