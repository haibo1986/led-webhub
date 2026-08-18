import type { Metadata } from "next";
import { headers } from "next/headers";

export type SiteLocale = "zh-CN" | "en";

// 站点基础 URL：优先 NEXT_PUBLIC_SITE_URL，否则按请求 host 推导（多租户部署时每个域名各得其所）。
export async function siteBaseUrl(): Promise<URL> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost";
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? `https://${host}`);
}

// 双语 hreflang + 当前语言 canonical（路径不带语言前缀，如 /products、/news/xxx）。
export function alternatesFor(locale: SiteLocale, path: string) {
  return { canonical: `/${locale}${path}`, languages: { "zh-CN": `/zh-CN${path}`, en: `/en${path}` } };
}

// 公开页统一元数据构造器。absolute 用于首页（避免「企业名 | 企业名」模板拼接）。
export async function publicMetadata(locale: SiteLocale, path: string, title: { "zh-CN": string; en: string }, opts?: { description?: { "zh-CN"?: string; en?: string }; absolute?: boolean }): Promise<Metadata> {
  return {
    metadataBase: await siteBaseUrl(),
    title: opts?.absolute ? { absolute: title[locale] } : title[locale],
    description: opts?.description?.[locale] ?? undefined,
    alternates: alternatesFor(locale, path),
  };
}
