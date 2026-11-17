import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PassportView } from "@/app/components/passport/PassportView";
import { getPassport } from "@/lib/passport";

// Public read-only Project Passport (backlog item 17). Reads only the
// public_* views (or the public-only sample fixture). Checked by
// `npm run check:public-page`, which fails if any private sample value
// appears in this page's HTML.

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const passport = await getPassport(slug);
  if (!passport) return { title: "Project not found" };

  // Link previews (backlog item 23d). The image comes from opengraph-image.tsx
  // in this folder; everything here is public data.
  const counts = { claim: 0, documented: 0, verified: 0 };
  for (const a of passport.assertions) counts[a.status] += 1;
  const sample = passport.source === "sample" || passport.project.is_sample;
  const title = `${passport.project.title} — Project Passport`;
  const description =
    `${sample ? "Fictional sample. " : ""}` +
    `${passport.organization?.name ? `${passport.organization.name}. ` : ""}` +
    `${counts.verified} verified, ${counts.documented} documented, ${counts.claim} claim${counts.claim === 1 ? "" : "s"}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", siteName: "The Light Web", url: `/p/${slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicPassportPage({ params }: Props) {
  const { slug } = await params;
  const passport = await getPassport(slug);
  if (!passport) notFound();
  return <PassportView passport={passport} publicView />;
}
