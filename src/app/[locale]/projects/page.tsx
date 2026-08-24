import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  return publicMetadata(locale, "/projects", { "zh-CN": "项目案例", en: "Projects" });
}

export default async function ProjectsPage({ params }: PageProps<"/[locale]/projects">) {
  const { locale } = await params; if (!isSiteLocale(locale)) notFound(); const tenant = await getPublicTenant(); const zh = locale === "zh-CN"; const dbLocale = localeToDb[locale];
  const cases = await getDb().projectCase.findMany({ where: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } }, orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], include: { translations: { where: { locale: dbLocale, isPublished: true }, take: 1 }, images: { where: { asset: { deletedAt: null } }, orderBy: { sortOrder: "asc" }, include: { asset: { select: { id: true } } } } } });
  return <main className="projects-page"><section className="inner-hero projects-hero"><p>SELECTED PROJECTS</p><h1>{zh ? "光，最终要在真实空间中被检验。" : "Light is ultimately tested in real space."}</h1><span>{zh ? "从建筑立面到城市公共空间，记录产品、光学与设计协作的真实成果。" : "Real outcomes from the collaboration of products, optics and design—from facades to public space."}</span></section><section className="project-index"><header><p>{zh ? "项目案例" : "PROJECT INDEX"}</p><span>{cases.length} {zh ? "个公开案例" : "published cases"}</span></header><div>{cases.map((item, index) => { const tr = item.translations[0]; const cover = item.images.find((img) => img.role === "COVER") ?? item.images[0]; return <Link href={`/${locale}/projects/${item.slug}`} key={item.id} className="project-card"><div className="project-card-art">{cover ? <img src={`/api/assets/${cover.asset.id}`} alt={tr.title} loading="lazy"/> : <><span>{String(index + 1).padStart(2,"0")}</span><i/><i/></>}</div><div>{item.category && <p>{item.category}</p>}<h2>{tr.title}</h2><span><MapPin/>{item.location ?? "—"}</span><b>{tr.summary}</b><em>{zh ? "查看案例" : "View project"}<ArrowUpRight/></em></div></Link> })}{cases.length === 0 && <p className="resource-empty">{zh ? "当前语言暂无已发布案例。" : "No projects are published in this language."}</p>}</div></section></main>;
}
