import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Light Web — Project Passport",
  description:
    "A transparent record of a ministry project: claims, documents, and independently verified results.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
