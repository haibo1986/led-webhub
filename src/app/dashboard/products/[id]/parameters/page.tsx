import Link from "next/link";
import type { CSSProperties } from "react";
import { CheckCircle2, ChevronLeft, Save, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../../../components/admin-page";
import { saveVariantParametersAction } from "./actions";

function rawValue(value: unknown) { return typeof value === "object" && value !== null && "raw" in value ? String((value as { raw: unknown }).raw) : ""; }

export default async function ParametersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const session = await requirePermission("content:write"); const { id } = await params; const state = await searchParams;
  const product = await getDb().product.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null }, include: { category: { include: { templates: { orderBy: { version: "desc" }, take: 1, include: { definitions: { orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }] } } } } }, variants: { orderBy: { sortOrder: "asc" }, include: { values: true } }, translations: { where: { locale: "ZH_CN" }, take: 1 } } });
  if (!product) notFound(); const template = product.category.templates[0]; const action = saveVariantParametersAction.bind(null, product.id);
  return <AdminPage title={`${product.model} · SKU 参数`} eyebrow="STRUCTURED SPECIFICATIONS" tenant={session.tenant.name} action={<Link className="primary-action secondary" href={`/dashboard/products/${id}`}><ChevronLeft/>返回产品</Link>}>
    {state.saved && <div className="save-notice"><CheckCircle2/>所有 SKU 参数已保存并记录审计日志。</div>}
    {!template ? <section className="empty-parameter"><SlidersHorizontal/><h2>当前分类还没有参数模板</h2><p>请先由平台管理员为“{product.category.nameZh}”配置模板。</p></section> : <form action={action} className="parameter-form"><div className="parameter-context"><div><p>产品</p><b>{product.translations[0]?.name ?? product.model}</b><span>{product.category.nameZh}</span></div><div><p>参数模板</p><b>{template.name}</b><span>版本 {template.version} · {template.definitions.length} 个字段</span></div><div><p>规格数量</p><b>{product.variants.length} SKU</b><span>横向比较录入</span></div></div>
      <div className="parameter-matrix" style={{ "--sku-count": Math.max(product.variants.length, 1) } as CSSProperties}><div className="parameter-row head"><span>参数字段</span>{product.variants.map((variant) => <span key={variant.id}>{variant.sku}<small>{variant.name}</small></span>)}</div>{template.definitions.map((definition) => <div className="parameter-row" key={definition.id}><span><b>{definition.labelZh}</b><small>{definition.labelEn ?? definition.key}{definition.unit ? ` · ${definition.unit}` : ""}</small><em>{definition.groupName}</em></span>{product.variants.map((variant) => { const existing = variant.values.find((value) => value.definitionId === definition.id); return <label key={variant.id}><input name={`param__${variant.id}__${definition.id}`} defaultValue={rawValue(existing?.valueJson)} required={definition.isRequired} placeholder={definition.unit ?? "输入参数"}/><i>{definition.unit}</i></label>; })}</div>)}</div>
      <div className="sticky-save"><p>事实参数不会由 AI 补写；保存后仍需发布产品才会展示到官网。</p><button><Save/>保存 SKU 参数</button></div>
    </form>}
  </AdminPage>;
}
