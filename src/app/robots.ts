import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = (await siteBaseUrl()).toString().replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: ["/zh-CN/", "/en/", "/"], disallow: ["/dashboard", "/login", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
