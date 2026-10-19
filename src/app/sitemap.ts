import type { MetadataRoute } from "next";

const PUBLIC_PATHS = ["/", "/chat", "/market", "/compare", "/checklist", "/survival", "/analysis", "/human", "/privacy", "/register"];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.PUBLIC_SITE_URL;
  if (!siteUrl) return [];
  const base = siteUrl.replace(/\/$/, "");
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
