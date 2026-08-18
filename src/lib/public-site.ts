import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export type SiteLocale = "zh-CN" | "en";
export const localeToDb = { "zh-CN": "ZH_CN", en: "EN" } as const;
export function isSiteLocale(value: string): value is SiteLocale { return value === "zh-CN" || value === "en"; }

// React cache：同一请求内 layout/page/generateMetadata 共享一次租户解析与查询。
// 部署约定：公开站租户按请求头解析——生产反向代理必须强制覆写 x-forwarded-host（不可透传客户端值），
// 否则流量会静默落到 DEFAULT_TENANT_SLUG 租户，且客户端可伪造该头切换公开站内容。
export const getPublicTenant = cache(async () => {
  const headerStore = await headers();
  const hostname = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").split(":")[0].toLowerCase();
  const defaultSlug = process.env.DEFAULT_TENANT_SLUG ?? "lumenworks";
  const select = { id: true, slug: true, name: true, shortName: true, description: true, email: true, phone: true, address: true, primaryColor: true, secondaryColor: true, publicDownloads: true } as const;
  const domainTenant = hostname ? await getDb().tenant.findFirst({
    where: { status: { in: ["TRIAL", "ACTIVE"] }, domains: { some: { hostname, isVerified: true } } },
    select,
  }) : null;
  const tenant = domainTenant ?? await getDb().tenant.findFirst({
    where: { slug: defaultSlug, status: { in: ["TRIAL", "ACTIVE"] } },
    select,
  });
  if (!tenant) notFound();
  return tenant;
});
