import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PassportView } from "@/app/components/passport/PassportView";
import { getPassport } from "@/lib/passport";

// Project record page. Today it shows the same public data as /p/[slug];
// once editing exists this becomes the editor's view.

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const passport = await getPassport(slug);
  return { title: passport ? `${passport.project.title} — Project Passport` : "Project not found" };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const passport = await getPassport(slug);
  if (!passport) notFound();
  return <PassportView passport={passport} />;
}
