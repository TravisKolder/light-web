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
  return { title: passport ? `${passport.project.title} — Public Passport` : "Project not found" };
}

export default async function PublicPassportPage({ params }: Props) {
  const { slug } = await params;
  const passport = await getPassport(slug);
  if (!passport) notFound();
  return <PassportView passport={passport} publicView />;
}
