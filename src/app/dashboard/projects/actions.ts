"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { tenantScope } from "@/lib/tenant/scope";
import { getDb } from "@/lib/db";

const schema = z.object({ slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), category: z.string().trim().min(2).max(60), location: z.string().trim().max(100), titleZh: z.string().trim().min(2).max(160), titleEn: z.string().trim().min(2).max(180), summaryZh: z.string().trim().max(300), summaryEn: z.string().trim().max(360), descriptionZh: z.string().trim().max(5000), descriptionEn: z.string().trim().max(5000) });
function parse(formData: FormData) { return schema.safeParse(Object.fromEntries([...schema.keyof().options.map(key => [key, String(formData.get(key) ?? "")])])); }

const productIdsSchema = z.array(z.string().trim().min(1).max(60)).max(50).default([]);
function parseProductIds(formData: FormData) { return productIdsSchema.safeParse(formData.getAll("productIds")); }

// 案例↔产品关联同步（审计 #26）：set 式重建；所有 id 必须先通过本租户存在性校验
async function syncCaseProducts(tx: { projectCaseProduct: { deleteMany: (args: { where: { caseId: string } }) => Promise<unknown>; createMany: (args: { data: { caseId: string; productId: string; sortOrder: number }[] }) => Promise<unknown> } }, tenantId: string, caseId: string, productIds: string[]) {
  const ids = [...new Set(productIds)];
  if (ids.length) {
    const owned = await getDb().product.findMany({ where: { id: { in: ids }, tenantId, deletedAt: null }, select: { id: true } });
    if (owned.length !== ids.length) throw new Error("TENANT_BOUNDARY_VIOLATION");
  }
  await tx.projectCaseProduct.deleteMany({ where: { caseId } });
  if (ids.length) await tx.projectCaseProduct.createMany({ data: ids.map((productId, sortOrder) => ({ caseId, productId, sortOrder })) });
}

export async function createProjectAction(formData: FormData) {
  const session = await requirePermission("content:write");
  const parsed = parse(formData);
  const parsedIds = parseProductIds(formData);
  if (!parsed.success || !parsedIds.success) redirect("/dashboard/projects/new?error=invalid");
  const d = parsed.data;
  const dup = await getDb().projectCase.findFirst({ where: { tenantId: session.tenantId, slug: d.slug }, select: { id: true } });
  if (dup) redirect("/dashboard/projects/new?error=duplicate");
  let itemId = "";
  try {
    await getDb().$transaction(async (tx) => {
      const item = await tx.projectCase.create({ data: { tenantId: session.tenantId, slug: d.slug, category: d.category, location: d.location || null, translations: { create: [{ locale: "ZH_CN", title: d.titleZh, summary: d.summaryZh, description: d.descriptionZh }, { locale: "EN", title: d.titleEn, summary: d.summaryEn, description: d.descriptionEn }] } } });
      await syncCaseProducts(tx, session.tenantId, item.id, parsedIds.data);
      await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PROJECT_CREATED", resource: "ProjectCase", resourceId: item.id } });
      itemId = item.id;
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") redirect("/dashboard/projects/new?error=duplicate");
    throw error;
  }
  redirect(`/dashboard/projects/${itemId}?created=1`);
}

export async function updateProjectAction(id: string, formData: FormData) {
  const session = await requirePermission("content:write");
  const parsedId = z.string().trim().max(60).safeParse(id);
  if (!parsedId.success) throw new Error("INVALID_INPUT");
  const parsed = parse(formData);
  const parsedIds = parseProductIds(formData);
  if (!parsed.success || !parsedIds.success) redirect(`/dashboard/projects/${parsedId.data}?error=invalid`);
  const item = await getDb().projectCase.findFirst({ where: { id: parsedId.data, tenantId: session.tenantId, deletedAt: null } });
  if (!item) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const d = parsed.data;
  const dup = await getDb().projectCase.findFirst({ where: { tenantId: session.tenantId, slug: d.slug, NOT: { id: parsedId.data } }, select: { id: true } });
  if (dup) redirect(`/dashboard/projects/${parsedId.data}?error=duplicate`);
  try {
    await getDb().$transaction(async (tx) => {
      await tx.projectCase.update({ where: { id: parsedId.data }, data: { slug: d.slug, category: d.category, location: d.location || null } });
      for (const tr of [["ZH_CN", d.titleZh, d.summaryZh, d.descriptionZh], ["EN", d.titleEn, d.summaryEn, d.descriptionEn]] as const) {
        await tx.projectCaseTranslation.upsert({ where: { caseId_locale: { caseId: parsedId.data, locale: tr[0] } }, update: { title: tr[1], summary: tr[2], description: tr[3] }, create: { caseId: parsedId.data, locale: tr[0], title: tr[1], summary: tr[2], description: tr[3] } });
      }
      await syncCaseProducts(tx, session.tenantId, parsedId.data, parsedIds.data);
      await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PROJECT_UPDATED", resource: "ProjectCase", resourceId: parsedId.data } });
    });
    revalidatePath(`/dashboard/projects/${parsedId.data}`);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") redirect(`/dashboard/projects/${parsedId.data}?error=duplicate`);
    throw error;
  }
  redirect(`/dashboard/projects/${parsedId.data}?saved=1`);
}

export async function setProjectStatusAction(id: string, locale: "ZH_CN" | "EN", publish: boolean) {
  const parsedId = z.string().trim().max(60).safeParse(id);
  const parsedLocale = z.enum(["ZH_CN", "EN"]).safeParse(locale);
  if (!parsedId.success || !parsedLocale.success || typeof publish !== "boolean") throw new Error("INVALID_INPUT");
  const session = await requirePermission("content:publish");
  const item = await getDb().projectCase.findFirst({ where: tenantScope(session.tenantId, { id: parsedId.data, deletedAt: null }), include: { translations: { where: { locale: parsedLocale.data }, take: 1 } } });
  if (!item?.translations[0]) throw new Error("TENANT_BOUNDARY_VIOLATION");
  await getDb().$transaction([
    getDb().projectCaseTranslation.update({ where: { id: item.translations[0].id }, data: { isPublished: publish } }),
    getDb().projectCase.update({ where: { id: parsedId.data }, data: publish ? { status: "PUBLISHED", publishedAt: new Date() } : {} }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: `PROJECT_${parsedLocale.data}_${publish ? "PUBLISHED" : "UNPUBLISHED"}`, resource: "ProjectCase", resourceId: parsedId.data } }),
  ]);
  revalidatePath(`/dashboard/projects/${parsedId.data}`);
  revalidatePath(parsedLocale.data === "ZH_CN" ? "/zh-CN/projects" : "/en/projects");
}

export async function deleteProjectAction(id: string) {
  const parsedId = z.string().trim().max(60).safeParse(id);
  if (!parsedId.success) throw new Error("INVALID_INPUT");
  const session = await requirePermission("content:write");
  const item = await getDb().projectCase.findFirst({ where: tenantScope(session.tenantId, { id: parsedId.data, deletedAt: null }) });
  if (!item) throw new Error("TENANT_BOUNDARY_VIOLATION");
  await getDb().$transaction([
    getDb().projectCase.update({ where: { id: parsedId.data }, data: { deletedAt: new Date(), status: "ARCHIVED" } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PROJECT_DELETED", resource: "ProjectCase", resourceId: parsedId.data } }),
  ]);
  redirect("/dashboard/projects?deleted=1");
}
