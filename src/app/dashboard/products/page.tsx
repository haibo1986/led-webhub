import Link from "next/link";
import { Archive, ChevronRight, FileUp, Languages, Package, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../components/admin-page";

const labels = { DRAFT: "草稿", PUBLISHED: "已发布", UNPUBLISHED: "已下架", ARCHIVED: "已归档" } as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const session = await requirePermission("content:read");
  const products = await getDb().product.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { category: { select: { nameZh: true } }, translations: { select: { locale: true, name: true, isPublished: true } }, _count: { select: { variants: true, assets: true } } } });
  const state = await searchParams;
  return <AdminPage title="产品资料" eyebrow="PRODUCT INFORMATION SYSTEM" tenant={session.tenant.name} action={<><Link className="primary-action" href="/dashboard/products/new"><Plus/>新增产品</Link><Link className="primary-action secondary" href="/dashboard/products/import"><FileUp/>批量导入</Link></>}>
    {state.deleted && <div className="save-notice"><Archive/>产品已软删除，可在后续回收站功能中恢复。</div>}
    <div className="list-toolbar"><div><Package/><span><b>{products.length}</b> 个有效产品</span></div><p>所有结果均由服务端强制限定为当前租户。</p></div>
    <section className="product-admin-table"><div className="admin-table-row head"><span>产品</span><span>分类</span><span>规格</span><span>语言</span><span>状态</span><span/></div>{products.map((product) => { const zh = product.translations.find((t) => t.locale === "ZH_CN"); const en = product.translations.find((t) => t.locale === "EN"); return <Link href={`/dashboard/products/${product.id}`} className="admin-table-row" key={product.id}><span><i>{product.model.slice(0,2)}</i><div><b>{zh?.name ?? product.model}</b><small>{product.model} · {en?.name ?? "English missing"}</small></div></span><span>{product.category.nameZh}</span><span>{product._count.variants} SKU</span><span className="language-state"><Languages/>{zh?.name ? "中" : "—"} / {en?.name ? "EN" : "—"}</span><span><em className={`status-${product.status.toLowerCase()}`}>{labels[product.status]}</em></span><span><ChevronRight/></span></Link>; })}{products.length === 0 && <div className="empty-products"><Package/><h2>还没有产品</h2><p>从创建分类下的第一个产品和 SKU 开始。</p><Link href="/dashboard/products/new">新增产品</Link></div>}</section>
  </AdminPage>;
}
