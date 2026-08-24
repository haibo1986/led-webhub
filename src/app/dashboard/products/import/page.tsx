import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../../components/admin-page";
import { ImportWizard } from "./import-wizard";

export default async function ProductImportPage() {
  const session = await requirePermission("content:write");
  const categories = await getDb().productCategory.findMany({ where: { tenantId: session.tenantId, isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, nameZh: true, nameEn: true } });
  return <AdminPage title="批量导入产品" eyebrow="BATCH IMPORT" tenant={session.tenant.name}><ImportWizard categories={categories} /></AdminPage>;
}
