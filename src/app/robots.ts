import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.PUBLIC_SITE_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/staff/", "/_next/"] }],
    ...(siteUrl ? { sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml` } : {}),
  };
}
