import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/news">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  return publicMetadata(locale, "/news", { "zh-CN": "新闻资讯", en: "News" });
}

export default async function NewsPage({ params }: PageProps<"/[locale]/news">) {
  const { locale } = await params; if (!isSiteLocale(locale)) notFound(); const tenant = await getPublicTenant(); const zh = locale === "zh-CN"; const dbLocale = localeToDb[locale];
  const posts = await getDb().newsPost.findMany({ where: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } }, orderBy: { publishedAt: "desc" }, include: { translations: { where: { locale: dbLocale, isPublished: true }, take: 1 } } });
  return <main className="news-page"><section className="inner-hero news-hero"><p>NEWS · OBSERVATIONS</p><h1>{zh ? "关于产品、项目与光的持续观察。" : "Ongoing observations on products, projects and light."}</h1></section><section className="news-list"><header><span>{zh ? "发布日期" : "DATE"}</span><span>{zh ? "资讯与观点" : "STORIES & NOTES"}</span><span>{zh ? "分类" : "CATEGORY"}</span></header>{posts.map(post => { const tr = post.translations[0]; return <Link href={`/${locale}/news/${post.slug}`} key={post.id}><time>{post.publishedAt?.toLocaleDateString(zh ? "zh-CN" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" })}</time><div><h2>{tr.title}</h2><p>{tr.excerpt}</p></div><span>{post.category}</span><ArrowRight/></Link> })}{posts.length === 0 && <p className="resource-empty">{zh ? "当前语言暂无资讯。" : "No news is published in this language."}</p>}</section></main>;
}
