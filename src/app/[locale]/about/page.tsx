import type { Metadata } from "next";
import { Award, Building2, Factory, Globe2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  const tenant = await getPublicTenant();
  return publicMetadata(locale, "/about", { "zh-CN": "关于我们", en: "About us" }, { description: { "zh-CN": tenant.description ?? undefined, en: tenant.description ?? undefined } });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params; if (!isSiteLocale(locale)) notFound(); const tenant = await getPublicTenant(); const zh = locale === "zh-CN"; const dbLocale = localeToDb[locale];
  const [products, cases, years] = await Promise.all([getDb().product.count({ where: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } } }), getDb().projectCase.count({ where: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } } }), getDb().productCategory.count({ where: { tenantId: tenant.id, isActive: true } })]);
  return <main className="story-page"><section className="inner-hero about-hero"><p>ABOUT · {tenant.name}</p><h1>{zh ? "以光为尺度，理解建筑与城市。" : "Light as a measure of architecture and cities."}</h1><span>{tenant.description ?? (zh ? "专注于建筑、景观与专业工程照明。" : "Focused on architectural, landscape and professional project lighting.")}</span></section><section className="about-manifesto"><div><p>{zh ? "企业使命" : "OUR PURPOSE"}</p><h2>{zh ? "让每一次照明决策，都建立在真实产品与可靠数据之上。" : "Make every lighting decision traceable to real products and reliable data."}</h2></div><div><p>{zh ? `${tenant.name} 面向设计师、工程顾问与项目团队，提供从灯具选型、配光参数到工程资料的一体化支持。我们相信好的光不是装饰，而是材料、空间与人的共同语言。` : `${tenant.name} supports designers, consultants and project teams with connected product selection, optical data and engineering documents. Good light is not decoration—it is a shared language of material, space and people.`}</p><p>{zh ? "官网展示内容均由企业团队直接维护并独立发布，确保每一项规格和资料都有明确归属。" : "All website content is maintained and published directly by the enterprise team, giving every specification and document clear ownership."}</p></div></section><section className="company-facts"><article><Building2/><b>{products}</b><span>{zh ? "已发布产品系统" : "Published products"}</span></article><article><Factory/><b>{years}</b><span>{zh ? "专业产品分类" : "Product categories"}</span></article><article><Award/><b>{cases}</b><span>{zh ? "公开项目案例" : "Published projects"}</span></article><article><Globe2/><b>2</b><span>{zh ? "独立发布语言" : "Published languages"}</span></article></section><section className="contact-band"><p>{zh ? "与我们建立联系" : "WORK WITH US"}</p><h2>{zh ? "从一个真实项目开始。" : "Start with a real project."}</h2><a href={`/${locale}/contact`}>{zh ? "联系技术与销售团队" : "Contact our technical and sales team"}</a></section></main>;
}
