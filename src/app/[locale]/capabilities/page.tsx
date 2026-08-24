import type { Metadata } from "next";
import { Building2, Factory, Leaf, Microscope, ShieldCheck, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/capabilities">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  return publicMetadata(locale, "/capabilities", { "zh-CN": "核心竞争力", en: "Core capabilities" }, { description: { "zh-CN": "从光学研发、精益制造到工程服务，面向专业照明项目的完整能力体系。", en: "From optical engineering and lean manufacturing to project support—a complete capability system for professional lighting." } });
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
  // 核心竞争力：企业能力视角（占位文案，可按企业真实能力改词；长期由 PRD 7.3 内容区块化支撑后台可维护）
  const strengths = zh ? [
    { icon: Microscope, index: "01", title: "光学研发", text: "自有光学平台与配光验证能力，覆盖洗墙、投光、线性与地埋等核心产品线。" },
    { icon: Factory, index: "02", title: "精益制造", text: "从结构件、驱动到光学组件的一体化生产，关键工序全检，出货前老化测试。" },
    { icon: Wrench, index: "03", title: "工程支持", text: "从选型、光效模拟到现场调试，为设计师与工程团队提供全程技术支持。" },
    { icon: Building2, index: "04", title: "项目交付", text: "服务建筑立面、景观与公共空间项目，按时交付并保障夜间实景效果。" },
    { icon: ShieldCheck, index: "05", title: "认证可靠", text: "产品通过国际安规与性能认证，防护等级与寿命指标以实测数据为准。" },
    { icon: Leaf, index: "06", title: "节能可持续", text: "高效率驱动与精准光学，降低项目长期运营能耗与维护成本。" },
  ] : [
    { icon: Microscope, index: "01", title: "Optical engineering", text: "In-house optics with verified beam control across wall washing, flood, linear and in-ground luminaires." },
    { icon: Factory, index: "02", title: "Lean manufacturing", text: "Integrated production from structure to driver and optics, with full-process inspection and burn-in testing." },
    { icon: Wrench, index: "03", title: "Engineering support", text: "Selection, photometric simulation and on-site commissioning for design and project teams." },
    { icon: Building2, index: "04", title: "Proven delivery", text: "Facade, landscape and public-space projects delivered on schedule with verified night-time results." },
    { icon: ShieldCheck, index: "05", title: "Certified reliability", text: "Internationally certified products with IP ratings and lifetime backed by measured data." },
    { icon: Leaf, index: "06", title: "Energy efficiency", text: "High-efficiency drivers and precision optics that reduce long-term operating cost." },
  ];
  return <main className="capabilities-page"><section className="inner-hero capabilities-hero"><p>CORE CAPABILITIES · {tenant.name}</p><h1>{zh ? "不只交付灯具，更交付被验证的专业能力。" : "Beyond luminaires—verified professional capability."}</h1><span>{zh ? "从光学研发、精益制造到工程服务，构建面向专业照明项目的完整能力体系。" : "From optical engineering and lean manufacturing to project support—a complete capability system for professional lighting."}</span></section><section className="capability-metrics"><article><b>{products}</b><span>{zh ? "已发布产品" : "Published products"}</span></article><article><b>{variants}</b><span>{zh ? "有效 SKU" : "Active SKUs"}</span></article><article><b>{categories}</b><span>{zh ? "产品分类" : "Product categories"}</span></article><article><b>{publicFiles}</b><span>{zh ? "公开资料" : "Public resources"}</span></article></section><section className="strength-grid">{strengths.map(({ icon: Icon, index, title, text }) => <article key={index}><div><span>{index}</span><Icon/></div><h2>{title}</h2><p>{text}</p></article>)}</section><section className="capability-statement"><p>OPTICS · MANUFACTURING · SERVICE</p><h2>{zh ? "让选型、沟通与交付使用同一份可信数据。" : "One trusted source for selection, communication and delivery."}</h2><a href={`/${locale}/contact`}>{zh ? "联系我们讨论项目" : "Discuss a project with us"}</a></section></main>;
}
