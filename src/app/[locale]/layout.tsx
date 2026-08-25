import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale } from "@/lib/public-site";
import { siteBaseUrl } from "@/lib/seo";
import { resolveNavigation, resolveSeo } from "@/lib/site-config";
import { PublicNavigation } from "./public-navigation";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  const tenant = await getPublicTenant();
  const seo = resolveSeo(tenant.seoConfig);
  const baseTitle = seo.defaultTitle ?? tenant.name;
  return {
    metadataBase: await siteBaseUrl(),
    title: { default: baseTitle, template: `%s | ${baseTitle}` },
    description: (locale === "zh-CN" ? seo.defaultDescriptionZh : seo.defaultDescriptionEn) ?? (locale === "zh-CN" ? tenant.description : tenant.descriptionEn) ?? tenant.description ?? undefined,
    keywords: (locale === "zh-CN" ? seo.keywordsZh : seo.keywordsEn) ?? undefined,
  };
}

export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isSiteLocale(locale)) notFound();
  const tenant = await getPublicTenant();
  const navItems = resolveNavigation(tenant.navigationConfig);
  const categories = await getDb().productCategory.findMany({ where: { tenantId: tenant.id, isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, nameZh: true, nameEn: true } });
  return <div className="public-site" style={{ "--tenant-accent": tenant.primaryColor, "--tenant-dark": tenant.secondaryColor } as CSSProperties}><PublicNavigation locale={locale} tenantName={tenant.shortName ?? tenant.name} categories={categories} items={navItems}/>{children}</div>;
}
