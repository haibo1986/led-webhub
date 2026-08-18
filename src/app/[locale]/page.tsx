import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Box, Download, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  const tenant = await getPublicTenant();
  return publicMetadata(locale, "", { "zh-CN": tenant.name, en: tenant.name }, { absolute: true, description: { "zh-CN": tenant.description ?? undefined, en: tenant.description ?? undefined } });
}

export default async function PublicHome({ params }: PageProps<"/[locale]">) {
  const { locale } = await params; if (!isSiteLocale(locale)) notFound(); const tenant = await getPublicTenant(); const dbLocale = localeToDb[locale];
  const products = await getDb().product.findMany({ where: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } }, orderBy: [{ featured: "desc" }, { updatedAt: "desc" }], take: 3, include: { translations: { where: { locale: dbLocale, isPublished: true }, take: 1 }, variants: { orderBy: { sortOrder: "asc" }, take: 4 } } });
  const zh = locale === "zh-CN"; const copy = zh ? { eyebrow: "建筑与景观照明 · 2026", title: "让光，成为", accent: "建筑的语言。", intro: tenant.description ?? "以结构化产品数据与可核验技术资料，为每一次照明决策提供依据。", explore: "探索产品", support: "获取选型支持", productTitle: "专业灯具，清晰到每个参数。", productIntro: "真实产品、多个 SKU、动态技术参数和公开工程资料，全部由企业后台独立维护。", detail: "查看产品详情", capability: "不只展示产品，交付决策依据。" } : { eyebrow: "ARCHITECTURAL LIGHTING · 2026", title: "Let light become", accent: "the language of architecture.", intro: tenant.description ?? "Structured product data and verifiable technical documents for confident lighting decisions.", explore: "Explore products", support: "Selection support", productTitle: "Professional luminaires. Every parameter, clear.", productIntro: "Real products, multiple SKUs, structured specifications and public engineering files — maintained by the enterprise team.", detail: "View product", capability: "Beyond products. Evidence for decisions." };
  return <main><section className="public-hero"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}<br/><em>{copy.accent}</em></h1><p>{copy.intro}</p><div className="hero-cta"><Link href={`/${locale}/products`}>{copy.explore}<ArrowRight/></Link><a href="#contact" className="quiet">{copy.support}</a></div></div><div className="light-study"><div className="light-beam"/><div className="fixture"><i/><i/><i/><i/><i/><i/></div><p>OPTICAL STUDY <span>DATA / LIGHT / SPACE</span></p></div></section>
    <section className="real-products"><div className="section-heading"><div><p className="eyebrow">PRODUCT SYSTEM</p><h2>{copy.productTitle}</h2></div><p>{copy.productIntro}</p></div><div className="real-product-grid">{products.map((product, index) => { const tr = product.translations[0]; return <Link href={`/${locale}/products/${product.slug}`} key={product.id} className="real-product-card"><span>0{index+1}</span><div className="mini-fixture"><i/></div><p>{product.model}</p><h3>{tr.name}</h3><small>{product.variants.map((v) => v.sku).join(" · ")}</small><b>{copy.detail}<ArrowRight/></b></Link>; })}{products.length === 0 && <div className="public-empty">{zh ? "当前语言尚无已发布产品。" : "No products are published in this language yet."}</div>}</div></section>
    <section className="capability" id="capability"><div><p className="eyebrow">ENGINEERING, DOCUMENTED</p><h2>{copy.capability}</h2></div><div className="capability-list"><span><Box/><b>{zh?"多规格体系":"Multi-SKU system"}</b><small>{zh?"一个产品完整管理多个规格":"Complete variant data per product"}</small></span><span><SlidersHorizontal/><b>{zh?"结构化参数":"Structured parameters"}</b><small>{zh?"真实数据驱动筛选与对比":"Reliable filtering and comparison"}</small></span><span><Download/><b>{zh?"公开资料下载":"Public downloads"}</b><small>PDF · IES · LDT · CAD</small></span><span><ShieldCheck/><b>{zh?"租户数据隔离":"Tenant isolation"}</b><small>{zh?"每项内容归属唯一企业":"Every record belongs to one company"}</small></span></div></section>
    <footer id="contact"><div className="brand-lockup"><span className="brand-mark"><span/></span><span>{tenant.name}</span></div><p>{tenant.email ?? tenant.phone ?? tenant.address}</p><Link href={`/${locale}/products`}>{copy.explore}<ArrowRight/></Link></footer></main>;
}
