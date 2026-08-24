import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Layers3, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

const PAGE_SIZE = 12;

export async function generateMetadata({ params }: PageProps<"/[locale]/products">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  return publicMetadata(locale, "/products", { "zh-CN": "产品中心", en: "Products" });
}

export default async function ProductIndex({ params, searchParams }: PageProps<"/[locale]/products">) {
  const { locale } = await params;
  if (!isSiteLocale(locale)) notFound();
  const query = await searchParams;
  const tenant = await getPublicTenant();
  const dbLocale = localeToDb[locale];
  const zh = locale === "zh-CN";
  const category = typeof query.category === "string" ? query.category : undefined;
  const q = typeof query.q === "string" && query.q.trim() ? query.q.trim() : undefined;
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const where = {
    tenantId: tenant.id,
    status: "PUBLISHED" as const,
    deletedAt: null,
    ...(category ? { category: { slug: category, isActive: true } } : {}),
    ...(q
      ? { translations: { some: { locale: dbLocale, isPublished: true, OR: [{ name: { contains: q, mode: "insensitive" as const } }, { tagline: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } } }
      : { translations: { some: { locale: dbLocale, isPublished: true } } }),
  };
  const [products, categories, total] = await Promise.all([
    getDb().product.findMany({
      where,
      orderBy: [{ category: { sortOrder: "asc" } }, { model: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: true, translations: { where: { locale: dbLocale, isPublished: true }, take: 1 }, variants: { orderBy: { sortOrder: "asc" }, take: 3 }, tags: { include: { tag: true } }, _count: { select: { assets: true, variants: { where: { isActive: true } } } } },
    }),
    getDb().productCategory.findMany({ where: { tenantId: tenant.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    getDb().product.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => `/${locale}/products?${new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}), page: String(target) }).toString()}`;
  return <main className="catalog-page">
    <header><div><p>PRODUCT CATALOG · {tenant.name}</p><h1>{zh ? "产品中心" : "Product catalog"}</h1></div><span>{zh ? "按真实型号、SKU 与技术数据浏览专业灯具。" : "Browse professional luminaires by model, SKU and verified technical data."}</span></header>
    <nav className="catalog-filters"><Link className={!category ? "active" : ""} href={`/${locale}/products`}>{zh ? "全部产品" : "All products"}</Link>{categories.map(item => <Link className={category === item.slug ? "active" : ""} href={`/${locale}/products?category=${item.slug}`} key={item.id}>{zh ? item.nameZh : (item.nameEn ?? item.nameZh)}</Link>)}</nav>
    <form className="catalog-search flex max-w-md gap-2" action={`/${locale}/products`} method="get">{category && <input type="hidden" name="category" value={category} />}<input className="min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-amber-500/60 focus:outline-none" type="search" name="q" defaultValue={q ?? ""} placeholder={zh ? "搜索产品名称、卖点或描述…" : "Search by name, tagline or description…"} /><button className="flex items-center gap-1.5 rounded bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"><Search size={15} />{zh ? "搜索" : "Search"}</button></form>
    <div className="catalog-grid">{products.map(product => <Link href={`/${locale}/products/${product.slug}`} key={product.id}><div className="catalog-art"><i /><span>{product.model}</span></div><p>{zh ? product.category.nameZh : (product.category.nameEn ?? product.category.nameZh)}</p><h2>{product.translations[0].name}</h2>{product.tags.length > 0 && <div className="catalog-tags">{product.tags.map(({ tag }) => <em key={tag.id}>{tag.name}</em>)}</div>}<div><span><Layers3 />{product._count.variants} SKU</span><span>{tenant.publicDownloads ? product._count.assets : 0} {zh ? "份资料" : "files"}</span></div><b>{zh ? "查看完整规格" : "View specifications"}<ArrowRight /></b></Link>)}{!products.length && <p className="public-empty">{q ? (zh ? `没有匹配「${q}」的产品。` : `No products match "${q}".`) : (zh ? "该分类暂无已发布产品。" : "No published products in this category.")}</p>}</div>
    {totalPages > 1 && <nav className="catalog-pagination flex items-center justify-center gap-4 pt-6 text-sm">{page > 1 && <Link className="rounded border border-neutral-800 px-4 py-2 text-neutral-300 hover:border-neutral-600" href={pageHref(page - 1)}>← {zh ? "上一页" : "Prev"}</Link>}<span className="text-neutral-500">{page} / {totalPages}</span>{page < totalPages && <Link className="rounded border border-neutral-800 px-4 py-2 text-neutral-300 hover:border-neutral-600" href={pageHref(page + 1)}>{zh ? "下一页" : "Next"} →</Link>}</nav>}
    {q && products.length > 0 && <p className="catalog-result-note pt-2 text-center text-sm text-neutral-500">{zh ? `共 ${total} 个匹配结果` : `${total} matching products`}</p>}
  </main>;
}
