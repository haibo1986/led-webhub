import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../../components/admin-page";
import { createProjectAction } from "../actions";
import { ProjectForm } from "../project-form";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{error?:string}> }) { const session = await requirePermission("content:write"); const state = await searchParams; const products = await getDb().product.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: { id: true, model: true, translations: { where: { locale: "ZH_CN" }, take: 1, select: { name: true } } } }); return <AdminPage title="新增应用案例" eyebrow="NEW PROJECT" tenant={session.tenant.name}>{state.error&&<div className="form-error">{state.error==="duplicate"?"该 URL 别名已存在，请更换后再试。":"请检查必填项和 URL 格式。"}</div>}<ProjectForm action={createProjectAction} submitLabel="创建案例" products={products.map((p) => ({ id: p.id, label: `${p.model} · ${p.translations[0]?.name ?? ""}` }))}/></AdminPage> }
