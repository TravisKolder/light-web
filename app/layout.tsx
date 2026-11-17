import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Light Web — Project Passport",
  description:
    "A transparent record of a ministry project: claims, documents, and independently verified results.",
  // Only fictional sample data for now: keep it out of search results so
  // sample records are never mistaken for real ministry projects.
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Render every page per request so Next.js can stamp each script with the
  // Content-Security-Policy nonce from proxy.ts. A prerendered page would carry
  // no nonce and its scripts would be blocked.
  await connection();
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">Skip to content</a>
        <div id="content" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
