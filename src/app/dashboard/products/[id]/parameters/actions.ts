"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";

export async function saveVariantParametersAction(productId: string, formData: FormData) {
  const session = await requirePermission("content:write");
  const parsedId = z.string().trim().max(60).safeParse(productId);
  if (!parsedId.success) throw new Error("INVALID_PRODUCT_ID");
  const product = await getDb().product.findFirst({ where: { id: parsedId.data, tenantId: session.tenantId, deletedAt: null }, include: { variants: { select: { id: true } }, category: { include: { templates: { orderBy: { version: "desc" }, take: 1, include: { definitions: { select: { id: true } } } } } } } });
  if (!product) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const variantIds = new Set(product.variants.map((item) => item.id));
  const definitionIds = new Set(product.category.templates[0]?.definitions.map((item) => item.id) ?? []);
  const writes: { variantId: string; definitionId: string; raw: string }[] = [];
  for (const [key, entry] of formData.entries()) {
    if (!key.startsWith("param__") || typeof entry !== "string") continue;
    const [, variantId, definitionId] = key.split("__");
    if (!variantIds.has(variantId) || !definitionIds.has(definitionId)) throw new Error("TENANT_BOUNDARY_VIOLATION");
    writes.push({ variantId, definitionId, raw: entry.trim() });
  }
  await getDb().$transaction(async (tx) => {
    // 批量 diff：非空值一次 deleteMany + createMany，空值一次 deleteMany（原来逐条 upsert 会有数百次往返）
    const nonEmpty = writes.filter((item) => item.raw);
    const emptyKeys = writes.filter((item) => !item.raw);
    if (nonEmpty.length) {
      await tx.variantParameterValue.deleteMany({ where: { OR: nonEmpty.map((item) => ({ variantId: item.variantId, definitionId: item.definitionId })) } });
      await tx.variantParameterValue.createMany({ data: nonEmpty.map((item) => ({ variantId: item.variantId, definitionId: item.definitionId, valueJson: { raw: item.raw } })) });
    }
    if (emptyKeys.length) await tx.variantParameterValue.deleteMany({ where: { OR: emptyKeys.map((item) => ({ variantId: item.variantId, definitionId: item.definitionId })) } });
    await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PRODUCT_PARAMETERS_UPDATED", resource: "Product", resourceId: productId, metadata: { values: writes.length } } });
  });
  revalidatePath(`/dashboard/products/${productId}/parameters`); redirect(`/dashboard/products/${productId}/parameters?saved=1`);
}
