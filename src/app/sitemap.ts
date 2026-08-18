import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { getPublicTenant, localeToDb } from "@/lib/public-site";
import { siteBaseUrl } from "@/lib/seo";

// 按请求 host 解析租户（与公开站同一套解析），只收录该租户当前语言已发布的内容。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getPublicTenant();
  const base = (await siteBaseUrl()).toString().replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of ["zh-CN", "en"] as const) {
    const dbLocale = localeToDb[locale];
    const prefix = `/${locale}`;
    const published = { tenantId: tenant.id, status: "PUBLISHED" as const, deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } };
    entries.push(
      { url: `${base}${prefix}`, priority: 1 },
      { url: `${base}${prefix}/products`, priority: 0.9 },
      { url: `${base}${prefix}/projects`, priority: 0.8 },
      { url: `${base}${prefix}/news`, priority: 0.8 },
      { url: `${base}${prefix}/about`, priority: 0.5 },
      { url: `${base}${prefix}/capabilities`, priority: 0.5 },
      { url: `${base}${prefix}/resources`, priority: 0.5 },
      { url: `${base}${prefix}/contact`, priority: 0.5 },
    );
    const [products, cases, posts] = await Promise.all([
      getDb().product.findMany({ where: published, select: { slug: true, updatedAt: true } }),
      getDb().projectCase.findMany({ where: published, select: { slug: true, updatedAt: true } }),
      getDb().newsPost.findMany({ where: published, select: { slug: true, updatedAt: true } }),
    ]);
    for (const p of products) entries.push({ url: `${base}${prefix}/products/${p.slug}`, lastModified: p.updatedAt, priority: 0.7 });
    for (const c of cases) entries.push({ url: `${base}${prefix}/projects/${c.slug}`, lastModified: c.updatedAt, priority: 0.6 });
    for (const n of posts) entries.push({ url: `${base}${prefix}/news/${n.slug}`, lastModified: n.updatedAt, priority: 0.6 });
  }
  return entries;
}
