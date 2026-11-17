import type { MetadataRoute } from "next";

// Only fictional sample data is published for now, so ask search engines not
// to crawl anything (site review S5). Revisit when real projects go public.
//
// Link-preview fetchers are allowed, so a passport link shared in a message
// still shows its title and share image (backlog 23d). Pages also carry
// `noindex`, which keeps them out of search results either way.
const PREVIEW_BOTS = [
  "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "Slackbot",
  "Slack-ImgProxy", "WhatsApp", "TelegramBot", "Discordbot", "Applebot", "iMessageBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: PREVIEW_BOTS, allow: "/p/", disallow: "/edit" },
      { userAgent: "*", disallow: "/" },
    ],
  };
}
