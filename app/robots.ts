import type { MetadataRoute } from "next";

// Only fictional sample data is published for now, so ask search engines not
// to crawl anything (site review S5). Revisit when real projects go public.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
