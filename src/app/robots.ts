import type { MetadataRoute } from "next";

// Favicon/metadata ticket: this is the signed-in console, not a
// marketing site — nothing here is meant to be crawled or indexed.
// Deliberately the opposite of a marketing site's robots.ts (which
// would allow indexing); do not copy this pattern onto one.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
