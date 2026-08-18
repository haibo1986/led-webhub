import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/news/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSiteLocale(locale)) return {};
  const tenant = await getPublicTenant();
  const post = await getDb().newsPost.findFirst({ where: { tenantId: tenant.id, slug, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: localeToDb[locale], isPublished: true } } }, include: { translations: { where: { locale: localeToDb[locale], isPublished: true }, take: 1 } } });
  if (!post?.translations[0]) notFound();
  const tr = post.translations[0];
  return publicMetadata(locale, `/news/${slug}`, { "zh-CN": tr.title, en: tr.title }, { description: { "zh-CN": tr.excerpt ?? undefined, en: tr.excerpt ?? undefined } });
}

export default async function NewsDetail({ params }: PageProps<"/[locale]/news/[slug]">) {
  const { locale, slug } = await params; if (!isSiteLocale(locale)) notFound(); const tenant = await getPublicTenant(); const zh = locale === "zh-CN"; const dbLocale = localeToDb[locale];
  const post = await getDb().newsPost.findFirst({ where: { tenantId: tenant.id, slug, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } }, include: { translations: { where: { locale: dbLocale, isPublished: true }, take: 1 } } });
  if (!post) notFound(); const tr = post.translations[0];
  return <main className="news-detail"><Link href={`/${locale}/news`}><ArrowLeft/>{zh ? "返回新闻资讯" : "Back to news"}</Link><header><p>{post.category} · {post.publishedAt?.toLocaleDateString(zh ? "zh-CN" : "en-US")}</p><h1>{tr.title}</h1><strong>{tr.excerpt}</strong></header><article>{(tr.body ?? tr.excerpt ?? "").split("\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article></main>;
}
