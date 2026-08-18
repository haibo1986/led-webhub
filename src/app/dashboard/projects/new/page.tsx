import { requirePermission } from "@/lib/auth/dal";
import { AdminPage } from "../../components/admin-page";
import { createProjectAction } from "../actions";
import { ProjectForm } from "../project-form";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{error?:string}> }) { const session = await requirePermission("content:write"); const state = await searchParams; return <AdminPage title="新增应用案例" eyebrow="NEW PROJECT" tenant={session.tenant.name}>{state.error&&<div className="form-error">{state.error==="duplicate"?"该 URL 别名已存在，请更换后再试。":"请检查必填项和 URL 格式。"}</div>}<ProjectForm action={createProjectAction} submitLabel="创建案例"/></AdminPage> }
