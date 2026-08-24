import { notFound } from "next/navigation";
import Link from "next/link";
import { Archive, CheckCircle2, EyeOff, FolderOpen, Send, SlidersHorizontal } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../../components/admin-page";
import { ConfirmForm } from "../../components/confirm-form";
import { setProductLocaleStatusAction, setProductStatusAction, updateProductAction } from "../actions";
import { ProductForm } from "../product-form";
import { AssetPartition } from "./asset-partition";
import { byRoles, PARTITIONS } from "@/lib/asset-roles";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; created?: string; error?: string; upload?: string }> }) {
  const session = await requirePermission("content:write"); const { id } = await params; const state = await searchParams;
  const [product, categories] = await Promise.all([getDb().product.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null }, include: { translations: true, variants: { orderBy: { sortOrder: "asc" } }, assets: { include: { asset: true }, orderBy: { sortOrder: "asc" } }, tags: { include: { tag: true } } } }), getDb().productCategory.findMany({ where: { tenantId: session.tenantId, isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, nameZh: true, nameEn: true } })]);
  if (!product) notFound(); const zh = product.translations.find((t) => t.locale === "ZH_CN"); const en = product.translations.find((t) => t.locale === "EN");
  const update = updateProductAction.bind(null, product.id); const publish = setProductStatusAction.bind(null, product.id, "publish"); const unpublish = setProductStatusAction.bind(null, product.id, "unpublish"); const remove = setProductStatusAction.bind(null, product.id, "delete");
  const publishZh = setProductLocaleStatusAction.bind(null, product.id, "ZH_CN", true); const unpublishZh = setProductLocaleStatusAction.bind(null, product.id, "ZH_CN", false); const publishEn = setProductLocaleStatusAction.bind(null, product.id, "EN", true); const unpublishEn = setProductLocaleStatusAction.bind(null, product.id, "EN", false);
  const actions = <div className="product-actions">{product.status !== "PUBLISHED" ? <form action={publish}><button className="publish"><Send/>发布</button></form> : <form action={unpublish}><button><EyeOff/>下架</button></form>}<ConfirmForm action={remove} message="确定删除该产品？SKU 参数数据将随产品一并归档，无法继续编辑。"><button className="danger"><Archive/>删除</button></ConfirmForm></div>;
  return <AdminPage title={`编辑 · ${product.model}`} eyebrow="PRODUCT EDITOR" tenant={session.tenant.name} action={actions}>{(state.saved || state.created) && <div className="save-notice"><CheckCircle2/>{state.created ? "产品草稿已创建。" : "产品内容与 SKU 已保存。"}</div>}{state.upload === "success" && <div className="save-notice"><CheckCircle2/>文件上传并关联成功。</div>}{state.upload && state.upload !== "success" && <div className="form-error">文件上传失败，请检查格式与 25MB 大小限制。</div>}{state.error && <div className="form-error">{state.error === "duplicate" ? "该 URL 别名或型号已存在，请更换后再试。" : "请检查必填项、URL 格式和 SKU 列表。"}</div>}
    <nav className="product-editor-nav"><Link className="active" href={`/dashboard/products/${id}`}>基础内容</Link><Link href={`/dashboard/products/${id}/parameters`}><SlidersHorizontal/>SKU 参数</Link></nav>
    <section className="locale-publish-panel"><div><p>独立语言发布</p><span>中文与英文页面可分别上线或下线；发布任一语言时会同步启用产品。</span></div><div className="locale-publish-actions"><form action={zh?.isPublished ? unpublishZh : publishZh}><button className={zh?.isPublished ? "is-live" : ""}><b>中文</b><span>{zh?.isPublished ? "已上线 · 点击下线" : "未上线 · 点击发布"}</span></button></form><form action={en?.isPublished ? unpublishEn : publishEn}><button className={en?.isPublished ? "is-live" : ""}><b>English</b><span>{en?.isPublished ? "Live · Unpublish" : "Offline · Publish"}</span></button></form></div></section>
    <ProductForm categories={categories} action={update} submitLabel="保存修改" value={{ categoryId: product.categoryId, model: product.model, slug: product.slug, nameZh: zh?.name ?? "", nameEn: en?.name ?? "", taglineZh: zh?.tagline ?? "", taglineEn: en?.tagline ?? "", skus: product.variants.map((v) => v.sku), tags: product.tags.map((t) => t.tag.name) }}/>
    <section className="form-card asset-manager"><div className="form-card-title"><div><h2>产品资料分区</h2><p>按 图片 / 尺寸图 / 技术资料 分区分组上传；公开站按相同分区展示。</p></div><FolderOpen/></div><AssetPartition productId={product.id} partition={PARTITIONS[0]} items={byRoles(product.assets, PARTITIONS[0].roles)} showThumb/><AssetPartition productId={product.id} partition={PARTITIONS[1]} items={byRoles(product.assets, PARTITIONS[1].roles)} showThumb/><AssetPartition productId={product.id} partition={PARTITIONS[2]} items={byRoles(product.assets, PARTITIONS[2].roles)} allowRoleChoice/></section>
  </AdminPage>;
}
