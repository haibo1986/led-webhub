import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSiteLocale(locale)) return {};
  const tenant = await getPublicTenant();
  const item = await getDb().projectCase.findFirst({ where: { tenantId: tenant.id, slug, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: localeToDb[locale], isPublished: true } } }, include: { translations: { where: { locale: localeToDb[locale], isPublished: true }, take: 1 }, images: { where: { asset: { deletedAt: null } }, orderBy: { sortOrder: "asc" }, include: { asset: { select: { id: true } } } } } });
  if (!item?.translations[0]) notFound();
  const tr = item.translations[0];
  const cover = item.images.find((img) => img.role === "COVER") ?? item.images[0];
  return publicMetadata(locale, `/projects/${slug}`, { "zh-CN": tr.title, en: tr.title }, { description: { "zh-CN": tr.summary ?? undefined, en: tr.summary ?? undefined }, ...(cover ? { openGraph: { images: [`/api/assets/${cover.asset.id}`] } } : {}) });
}

export default async function ProjectDetail({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params; if (!isSiteLocale(locale)) notFound(); const tenant = await getPublicTenant(); const zh = locale === "zh-CN"; const dbLocale = localeToDb[locale];
  const item = await getDb().projectCase.findFirst({
    where: { tenantId: tenant.id, slug, status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } },
    include: {
      translations: { where: { locale: dbLocale, isPublished: true }, take: 1 },
      products: { orderBy: { sortOrder: "asc" }, include: { product: { select: { slug: true, model: true, status: true, deletedAt: true, translations: { where: { locale: dbLocale, isPublished: true }, take: 1, select: { name: true } } } } } },
      images: { where: { asset: { deletedAt: null } }, orderBy: [{ role: "asc" }, { sortOrder: "asc" }], include: { asset: { select: { id: true, fileName: true } } } },
    },
  });
  if (!item) notFound(); const tr = item.translations[0];
  const linkedProducts = item.products.map((p) => p.product).filter((p) => p.status === "PUBLISHED" && p.deletedAt === null && p.translations.length > 0);
  return <main className="editorial-detail"><Link href={`/${locale}/projects`}><ArrowLeft/>{zh ? "返回案例" : "Back to projects"}</Link><section>{item.category || item.location ? <p>{[item.category, item.location].filter(Boolean).join(" · ")}</p> : null}<h1>{tr.title}</h1><strong>{tr.summary}</strong></section>{item.images.length > 0 ? <div className="case-gallery">{item.images.map((img) => <figure key={img.asset.id}><img src={`/api/assets/${img.asset.id}`} alt={tr.title} loading="lazy"/>{img.role === "COVER" && <figcaption>{zh ? "封面" : "Cover"}</figcaption>}</figure>)}</div> : <div className="detail-visual"><i/><span>LIGHT / MATERIAL / PLACE</span></div>}<article><aside><MapPin/><span>{item.location}</span><b>{item.publishedAt?.getFullYear()}</b></aside><div><p>{tr.description ?? tr.summary}</p><blockquote>{zh ? "不是让建筑变亮，而是让它在夜晚仍然保持自己的秩序。" : "The aim is not to make architecture bright, but to preserve its order after dark."}</blockquote>{linkedProducts.length > 0 && <section className="case-products"><p>{zh ? "本案所用产品" : "PRODUCTS USED"}</p><div>{linkedProducts.map((p) => <Link key={p.slug} href={`/${locale}/products/${p.slug}`}><b>{p.model}</b><span>{p.translations[0].name}</span></Link>)}</div></section>}</div></article></main>;
}
