import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../../components/admin-page";
import { createProductAction } from "../actions";
import { ProductForm } from "../product-form";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requirePermission("content:write"); const state = await searchParams;
  const categories = await getDb().productCategory.findMany({ where: { tenantId: session.tenantId, isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, nameZh: true, nameEn: true } });
  return <AdminPage title="新增产品" eyebrow="NEW PRODUCT" tenant={session.tenant.name}>{state.error && <div className="form-error">{state.error === "duplicate" ? "该 URL 别名或型号已存在，请更换后再试。" : "请检查必填项、URL 格式和 SKU 列表。"}</div>}<ProductForm categories={categories} action={createProductAction}/></AdminPage>;
}
