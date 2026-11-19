import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { connection } from "next/server";
import { StatusBadge } from "@/app/components/StatusBadge";
import "./globals.css";

// Typefaces, self-hosted under the SIL Open Font License so the
// Content-Security-Policy can stay at font-src 'self'.
// Headings: Newsreader, an editorial serif (a record you can trust).
// Body: Hanken Grotesk, a warm, open sans that stays readable at small sizes.
const serif = localFont({
  src: "./fonts/newsreader-latin-opsz-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-serif",
});
const sans = localFont({
  src: "./fonts/hanken-grotesk-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
});

// Absolute base for link-preview URLs: the site's own address on Vercel.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  openGraph: {
    siteName: "The Light Web",
    title: "The Light Web — Project Passports",
    description: "Don't merely verify the story. Verify the fruit.",
    type: "website",
  },
  twitter: { card: "summary" },
  title: "Light Web — Project Passport",
  description:
    "A transparent record of a ministry project: claims, documents, and independently verified results.",
  // Only fictional sample data for now: keep it out of search results so
  // sample records are never mistaken for real ministry projects.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffefb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a221d" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Render every page per request so Next.js can stamp each script with the
  // Content-Security-Policy nonce from proxy.ts. A prerendered page would carry
  // no nonce and its scripts would be blocked.
  await connection();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <a className="skip-link" href="#content">Skip to content</a>
        <header className="site-header">
          <div className="site-inner">
            <Link href="/" className="wordmark">
              <svg className="mark" viewBox="0 0 54 18" width="48" height="16" aria-hidden="true">
                <g stroke="currentColor" strokeWidth="2" fill="none">
                  <circle cx="9" cy="9" r="6.5" strokeDasharray="2.6 2" />
                  <circle cx="27" cy="9" r="6.5" />
                  <path d="M27 2.5a6.5 6.5 0 0 0 0 13z" fill="currentColor" stroke="none" />
                  <circle cx="45" cy="9" r="6.5" fill="currentColor" />
                </g>
              </svg>
              The Light Web
            </Link>
            <nav aria-label="Site">
              <Link href="/p">Projects</Link>
              <Link href="/#how-it-works">How it works</Link>
            </nav>
          </div>
        </header>
        <div id="content" tabIndex={-1}>{children}</div>
        <footer className="site-footer">
          <div className="site-inner">
            <p>
              The Light Web keeps a transparent record of ministry projects, so that
              what is claimed, what is documented, and what has been independently
              verified are never confused.
            </p>
            <div className="badge-legend" aria-label="Statement status legend">
              <StatusBadge status="claim" />
              <StatusBadge status="documented" />
              <StatusBadge status="verified" />
            </div>
            <p className="muted small">
              Early prototype. All projects shown are fictional samples used to
              demonstrate the format. Money is only recorded here, never collected
              or moved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
