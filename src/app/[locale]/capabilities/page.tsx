import type { Metadata } from "next";
import { BadgeCheck, Boxes, FileCheck2, Languages, ShieldCheck, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/capabilities">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  return publicMetadata(locale, "/capabilities", { "zh-CN": "核心能力", en: "Capabilities" }, { description: { "zh-CN": "从结构化产品数据到双语发布与工程资料交付的完整数字能力。", en: "A complete digital capability from structured product data to bilingual publishing and engineering delivery." } });
}

export default async function CapabilitiesPage({ params }: PageProps<"/[locale]/capabilities">) {
  const { locale } = await params;
  if (!isSiteLocale(locale)) notFound();
  const tenant = await getPublicTenant();
  const zh = locale === "zh-CN";
  const dbLocale = localeToDb[locale];
  const [products, variants, categories, publicFiles] = await Promise.all([
    getDb().product.count({ where: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } } }),
    getDb().productVariant.count({ where: { product: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } }, isActive: true } }),
    getDb().productCategory.count({ where: { tenantId: tenant.id, isActive: true } }),
    getDb().asset.count({ where: { tenantId: tenant.id, visibility: "PUBLIC", deletedAt: null } }),
  ]);
  const strengths = zh ? [
    { icon: Boxes, index: "01", title: "真实多 SKU 产品体系", text: "一个产品统一管理多个规格、型号和差异化参数，避免重复维护与数据冲突。" },
    { icon: Wrench, index: "02", title: "结构化动态技术参数", text: "参数模板随产品分类配置，功率、光束角、防护等级等数据可以持续扩展。" },
    { icon: FileCheck2, index: "03", title: "可核验工程资料", text: "产品规格书、IES、LDT、CAD 与 STEP 文件和真实产品建立明确关联。" },
    { icon: Languages, index: "04", title: "中英文独立发布", text: "中文与英文内容分别编辑、审核、上线或下线，适应不同市场节奏。" },
    { icon: ShieldCheck, index: "05", title: "企业级租户隔离", text: "产品、案例、新闻、附件与询盘全部限定在当前企业的数据边界内。" },
    { icon: BadgeCheck, index: "06", title: "企业直接维护发布", text: "企业编辑完成内容后可以直接发布，让官网始终反映最新真实产品状态。" },
  ] : [
    { icon: Boxes, index: "01", title: "Real multi-SKU product system", text: "Manage multiple variants and their differences under one product without duplicated records." },
    { icon: Wrench, index: "02", title: "Structured dynamic specifications", text: "Category-specific templates keep power, beam, protection and future parameters extensible." },
    { icon: FileCheck2, index: "03", title: "Verifiable engineering resources", text: "Datasheets, IES, LDT, CAD and STEP files remain explicitly connected to real products." },
    { icon: Languages, index: "04", title: "Independent bilingual publishing", text: "Chinese and English content can be edited, published and withdrawn on separate schedules." },
    { icon: ShieldCheck, index: "05", title: "Enterprise tenant isolation", text: "Products, projects, news, files and inquiries stay inside the current company boundary." },
    { icon: BadgeCheck, index: "06", title: "Direct enterprise publishing", text: "Enterprise editors publish updates directly so the website reflects current product truth." },
  ];
  return <main className="capabilities-page"><section className="inner-hero capabilities-hero"><p>CORE CAPABILITIES · {tenant.name}</p><h1>{zh ? "不只展示灯具，更建立可靠的产品真相。" : "Beyond displaying luminaires—building a reliable product truth."}</h1><span>{zh ? "从结构化产品数据到双语发布与工程资料交付，形成面向专业照明决策的完整数字能力。" : "A complete digital capability for professional lighting decisions, from structured product data to bilingual publishing and engineering delivery."}</span></section><section className="capability-metrics"><article><b>{products}</b><span>{zh ? "已发布产品" : "Published products"}</span></article><article><b>{variants}</b><span>{zh ? "有效 SKU" : "Active SKUs"}</span></article><article><b>{categories}</b><span>{zh ? "产品分类" : "Product categories"}</span></article><article><b>{publicFiles}</b><span>{zh ? "公开资料" : "Public resources"}</span></article></section><section className="strength-grid">{strengths.map(({ icon: Icon, index, title, text }) => <article key={index}><div><span>{index}</span><Icon/></div><h2>{title}</h2><p>{text}</p></article>)}</section><section className="capability-statement"><p>PRODUCT DATA · DOCUMENTS · GOVERNANCE</p><h2>{zh ? "让选型、沟通与交付使用同一份可信数据。" : "One trusted source for selection, communication and delivery."}</h2><a href={`/${locale}/contact`}>{zh ? "联系我们讨论项目" : "Discuss a project with us"}</a></section></main>;
}
