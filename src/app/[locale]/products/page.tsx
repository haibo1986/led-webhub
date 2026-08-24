import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Layers3, Search, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";
import { collectFilterValues, filterHref, parseParamFilters, toggleFilter, type ParamFilter } from "@/lib/product-filter";

const PAGE_SIZE = 12;

function toSearchParams(query: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const v of value) out.append(key, v);
    else if (typeof value === "string" && value) out.set(key, value);
  }
  return out;
}

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
  // 参数筛选：f_<key>=<value>。definition.key 在租户内不唯一（每分类模板各有一组），
  // 同一 key 需聚合为「任一同名定义命中」；跨参数的 AND 语义由每个 filter 一个 variants.some 承载。
  const rawFilters = parseParamFilters(toSearchParams(query));
  const filterDefs = await getDb().parameterDefinition.findMany({ where: { isFilterable: true, template: { category: { tenantId: tenant.id, isActive: true, ...(category ? { slug: category } : {}) } } }, orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }], select: { id: true, key: true, labelZh: true, labelEn: true, unit: true } });
  const defsByKey = new Map<string, typeof filterDefs>();
  for (const d of filterDefs) {
    const list = defsByKey.get(d.key);
    if (list) list.push(d);
    else defsByKey.set(d.key, [d]);
  }
  const paramFilters: ParamFilter[] = rawFilters.filter((f) => defsByKey.has(f.key));
  const variantWhere = paramFilters.map((f) => ({ definitionId: { in: defsByKey.get(f.key)!.map((d) => d.id) }, valueJson: { equals: { raw: f.value } } }));
  const where = {
    tenantId: tenant.id,
    status: "PUBLISHED" as const,
    deletedAt: null,
    ...(category ? { category: { slug: category, isActive: true } } : {}),
    ...(q
      ? { translations: { some: { locale: dbLocale, isPublished: true, OR: [{ name: { contains: q, mode: "insensitive" as const } }, { tagline: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } } }
      : { translations: { some: { locale: dbLocale, isPublished: true } } }),
    // 多参数筛选语义：产品存在一个 SKU 同时命中全部筛选（规格组合匹配，不跨 SKU 拼凑）
    ...(variantWhere.length ? { variants: { some: { isActive: true, AND: variantWhere.map((w) => ({ values: { some: w } })) } } } : {}),
  };
  const [products, categories, total, filterValues] = await Promise.all([
    getDb().product.findMany({
      where,
      orderBy: [{ category: { sortOrder: "asc" } }, { model: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: true, translations: { where: { locale: dbLocale, isPublished: true }, take: 1 }, variants: { orderBy: { sortOrder: "asc" }, take: 3 }, tags: { include: { tag: true } }, _count: { select: { assets: true, variants: { where: { isActive: true } } } } },
    }),
    getDb().productCategory.findMany({ where: { tenantId: tenant.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    getDb().product.count({ where }),
    filterDefs.length
      ? getDb().variantParameterValue.findMany({
          where: { definitionId: { in: filterDefs.map((d) => d.id) }, variant: { isActive: true, product: { tenantId: tenant.id, status: "PUBLISHED", deletedAt: null, ...(category ? { category: { slug: category } } : {}), translations: { some: { locale: dbLocale, isPublished: true } } } } },
          select: { definitionId: true, valueJson: true },
          take: 2000,
        })
      : Promise.resolve([] as { definitionId: string; valueJson: unknown }[]),
  ]);
  const rawValueOf = (v: unknown) => (typeof (v as { raw?: unknown } | null)?.raw === "string" ? String((v as { raw: string }).raw) : "");
  const valueMapByDef = collectFilterValues(filterValues.map((v) => ({ definitionId: v.definitionId, raw: rawValueOf(v.valueJson) })).filter((v) => v.raw), filterDefs.map((d) => d.id));
  // 按 key 合并各同名定义的值集合（面板一行一参数）
  const valueMap = new Map<string, string[]>();
  for (const [key, defs] of defsByKey) {
    const set = new Set<string>();
    for (const d of defs) for (const v of valueMapByDef.get(d.id) ?? []) set.add(v);
    valueMap.set(key, [...set].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true })));
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sp = toSearchParams(query);
  const baseQuery = filterHref(sp, paramFilters);
  const pageHref = (target: number) => `/${locale}/products?${baseQuery ? `${baseQuery}&` : ""}page=${target}`;
  return <main className="catalog-page">
    <header><div><p>PRODUCT CATALOG · {tenant.name}</p><h1>{zh ? "产品中心" : "Product catalog"}</h1></div><span>{zh ? "按真实型号、SKU 与技术数据浏览专业灯具。" : "Browse professional luminaires by model, SKU and verified technical data."}</span></header>
    <nav className="catalog-filters"><Link className={!category ? "active" : ""} href={`/${locale}/products`}>{zh ? "全部产品" : "All products"}</Link>{categories.map(item => <Link className={category === item.slug ? "active" : ""} href={`/${locale}/products?category=${item.slug}`} key={item.id}>{zh ? item.nameZh : (item.nameEn ?? item.nameZh)}</Link>)}</nav>
    {defsByKey.size > 0 && <section className="param-filters"><div className="param-filters-head"><span><SlidersHorizontal/>{zh ? "按参数筛选" : "Filter by parameters"}</span>{paramFilters.length > 0 && <Link href={`/${locale}/products?${filterHref(sp, [])}`}>{zh ? "清除全部筛选" : "Clear all"}</Link>}</div>{[...defsByKey.entries()].map(([key, defs]) => { const def = defs[0]; const values = valueMap.get(key) ?? []; const current = paramFilters.find((f) => f.key === key)?.value; return <div className="param-filter-row" key={key}><span>{zh ? def.labelZh : (def.labelEn ?? def.labelZh)}</span><div>{values.map((v) => <Link className={current === v ? "active" : ""} href={`/${locale}/products?${filterHref(sp, toggleFilter(paramFilters, key, v))}`} key={v}>{v}{def.unit ? ` ${def.unit}` : ""}</Link>)}{current && <Link className="param-clear" href={`/${locale}/products?${filterHref(sp, paramFilters.filter((f) => f.key !== key))}`}>{zh ? "清除" : "Clear"}</Link>}{!values.length && <em>{zh ? "暂无已发布数据" : "No published values"}</em>}</div></div>; })}</section>}
    <form className="catalog-search flex max-w-md gap-2" action={`/${locale}/products`} method="get">{category && <input type="hidden" name="category" value={category} />}<input className="min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-amber-500/60 focus:outline-none" type="search" name="q" defaultValue={q ?? ""} placeholder={zh ? "搜索产品名称、卖点或描述…" : "Search by name, tagline or description…"} /><button className="flex items-center gap-1.5 rounded bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"><Search size={15} />{zh ? "搜索" : "Search"}</button></form>
    <div className="catalog-grid">{products.map(product => <Link href={`/${locale}/products/${product.slug}`} key={product.id}><div className="catalog-art"><i /><span>{product.model}</span></div><p>{zh ? product.category.nameZh : (product.category.nameEn ?? product.category.nameZh)}</p><h2>{product.translations[0].name}</h2>{product.tags.length > 0 && <div className="catalog-tags">{product.tags.map(({ tag }) => <em key={tag.id}>{tag.name}</em>)}</div>}<div><span><Layers3 />{product._count.variants} SKU</span><span>{tenant.publicDownloads ? product._count.assets : 0} {zh ? "份资料" : "files"}</span></div><b>{zh ? "查看完整规格" : "View specifications"}<ArrowRight /></b></Link>)}{!products.length && <p className="public-empty">{q ? (zh ? `没有匹配「${q}」的产品。` : `No products match "${q}".`) : (zh ? "该分类暂无已发布产品。" : "No published products in this category.")}</p>}</div>
    {totalPages > 1 && <nav className="catalog-pagination flex items-center justify-center gap-4 pt-6 text-sm">{page > 1 && <Link className="rounded border border-neutral-800 px-4 py-2 text-neutral-300 hover:border-neutral-600" href={pageHref(page - 1)}>← {zh ? "上一页" : "Prev"}</Link>}<span className="text-neutral-500">{page} / {totalPages}</span>{page < totalPages && <Link className="rounded border border-neutral-800 px-4 py-2 text-neutral-300 hover:border-neutral-600" href={pageHref(page + 1)}>{zh ? "下一页" : "Next"} →</Link>}</nav>}
    {q && products.length > 0 && <p className="catalog-result-note pt-2 text-center text-sm text-neutral-500">{zh ? `共 ${total} 个匹配结果` : `${total} matching products`}</p>}
  </main>;
}
