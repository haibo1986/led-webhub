"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { parseProductForm } from "@/lib/products/schema";
import { createTranslateAction } from "@/lib/translate-factory";
import { diffVariants } from "@/lib/products/variant-diff";

const parse = parseProductForm;

// 标签同步（set 式）：清空后按去重名单重建连接，缺失标签自动创建（租户级共享）
async function syncTags(tx: { productTagLink: { deleteMany: (args: { where: { productId: string } }) => Promise<unknown>; create: (args: { data: { productId: string; tagId: string } }) => Promise<unknown> }; productTag: { upsert: (args: { where: { tenantId_name: { tenantId: string; name: string } }; update: Record<string, never>; create: { tenantId: string; name: string } }) => Promise<{ id: string }> } }, tenantId: string, productId: string, names: string[]) {
  await tx.productTagLink.deleteMany({ where: { productId } });
  for (const name of new Set(names)) {
    const tag = await tx.productTag.upsert({ where: { tenantId_name: { tenantId, name } }, update: {}, create: { tenantId, name } });
    await tx.productTagLink.create({ data: { productId, tagId: tag.id } });
  }
}

export async function createProductAction(formData: FormData) {
  const session = await requirePermission("content:write"); const parsed = parse(formData);
  if (!parsed.success) redirect("/dashboard/products/new?error=invalid");
  const category = await getDb().productCategory.findFirst({ where: { id: parsed.data.categoryId, tenantId: session.tenantId, isActive: true }, select: { id: true } });
  if (!category) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const duplicate = await getDb().product.findFirst({ where: { tenantId: session.tenantId, OR: [{ slug: parsed.data.slug }, { model: parsed.data.model }] }, select: { id: true } });
  if (duplicate) redirect("/dashboard/products/new?error=duplicate");
  let productId = "";
  try {
    await getDb().$transaction(async (tx) => {
      const product = await tx.product.create({ data: { tenantId: session.tenantId, categoryId: category.id, model: parsed.data.model, slug: parsed.data.slug, translations: { create: [{ locale: "ZH_CN", name: parsed.data.nameZh, tagline: parsed.data.taglineZh }, { locale: "EN", name: parsed.data.nameEn, tagline: parsed.data.taglineEn }] }, variants: { create: parsed.data.skus.map((sku, i) => ({ sku, name: sku, sortOrder: i })) } } });
      await syncTags(tx, session.tenantId, product.id, parsed.data.tags);
      await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PRODUCT_CREATED", resource: "Product", resourceId: product.id } });
      productId = product.id;
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") redirect("/dashboard/products/new?error=duplicate");
    throw error;
  }
  revalidatePath("/dashboard/products"); redirect(`/dashboard/products/${productId}?created=1`);
}

export async function updateProductAction(productId: string, formData: FormData) {
  const session = await requirePermission("content:write"); const parsed = parse(formData);
  if (!parsed.success) redirect(`/dashboard/products/${productId}?error=invalid`);
  const existing = await getDb().product.findFirst({ where: { id: productId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
  const category = await getDb().productCategory.findFirst({ where: { id: parsed.data.categoryId, tenantId: session.tenantId, isActive: true }, select: { id: true } });
  if (!existing || !category) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const duplicate = await getDb().product.findFirst({ where: { tenantId: session.tenantId, OR: [{ slug: parsed.data.slug }, { model: parsed.data.model }], NOT: { id: productId } }, select: { id: true } });
  if (duplicate) redirect(`/dashboard/products/${productId}?error=duplicate`);
  try {
    await getDb().$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { categoryId: category.id, model: parsed.data.model, slug: parsed.data.slug } });
      for (const item of [["ZH_CN", parsed.data.nameZh, parsed.data.taglineZh], ["EN", parsed.data.nameEn, parsed.data.taglineEn]] as const) await tx.productTranslation.upsert({ where: { productId_locale: { productId, locale: item[0] } }, update: { name: item[1], tagline: item[2] }, create: { productId, locale: item[0], name: item[1], tagline: item[2] } });
      // diff 式更新变体：只删被移除的 SKU、只增新 SKU，未变的保留原 id，避免级联清空参数值
      const existingVariants = await tx.productVariant.findMany({ where: { productId }, select: { id: true, sku: true } });
      const { toDeleteIds: toDelete, toCreateSkus: toCreate } = diffVariants(existingVariants, parsed.data.skus);
      if (toDelete.length) await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
      for (const [i, sku] of parsed.data.skus.entries()) await tx.productVariant.updateMany({ where: { productId, sku, id: { notIn: toDelete } }, data: { sortOrder: i } });
      if (toCreate.length) await tx.productVariant.createMany({ data: toCreate.map((sku) => ({ productId, sku, name: sku, sortOrder: parsed.data.skus.indexOf(sku) })) });
      await syncTags(tx, session.tenantId, productId, parsed.data.tags);
      await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PRODUCT_UPDATED", resource: "Product", resourceId: productId } });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") redirect(`/dashboard/products/${productId}?error=duplicate`);
    throw error;
  }
  revalidatePath("/dashboard/products"); revalidatePath(`/dashboard/products/${productId}`); redirect(`/dashboard/products/${productId}?saved=1`);
}

export async function setProductStatusAction(productId: string, intent: "publish" | "unpublish" | "delete") {
  const parsedId = z.string().trim().max(60).safeParse(productId);
  const parsedIntent = z.enum(["publish", "unpublish", "delete"]).safeParse(intent);
  if (!parsedId.success || !parsedIntent.success) throw new Error("INVALID_INPUT");
  const session = await requirePermission(parsedIntent.data === "delete" ? "content:write" : "content:publish");
  const product = await getDb().product.findFirst({ where: { id: parsedId.data, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
  if (!product) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const id = parsedId.data; const action = parsedIntent.data;
  const data = action === "publish" ? { status: "PUBLISHED" as const, publishedAt: new Date() } : action === "unpublish" ? { status: "UNPUBLISHED" as const } : { deletedAt: new Date(), status: "ARCHIVED" as const };
  await getDb().$transaction([getDb().product.update({ where: { id }, data }), getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: `PRODUCT_${action.toUpperCase()}`, resource: "Product", resourceId: id } })]);
  revalidatePath("/dashboard/products"); if (action === "delete") redirect("/dashboard/products?deleted=1");
}

export async function setProductLocaleStatusAction(productId: string, locale: "ZH_CN" | "EN", publish: boolean) {
  const parsedId = z.string().trim().max(60).safeParse(productId);
  const parsedLocale = z.enum(["ZH_CN", "EN"]).safeParse(locale);
  if (!parsedId.success || !parsedLocale.success || typeof publish !== "boolean") throw new Error("INVALID_INPUT");
  const session = await requirePermission("content:publish");
  const translation = await getDb().productTranslation.findFirst({
    where: { productId: parsedId.data, locale: parsedLocale.data, product: { tenantId: session.tenantId, deletedAt: null } },
    select: { id: true, name: true },
  });
  if (!translation) throw new Error("TENANT_BOUNDARY_VIOLATION");
  // 发布守卫：名称为空（未填写/未翻译）不可发布该语言
  if (publish && !translation.name.trim()) redirect(`/dashboard/products/${parsedId.data}?translated=empty`);
  await getDb().$transaction(async (tx) => {
    await tx.productTranslation.update({ where: { id: translation.id }, data: { isPublished: publish } });
    if (publish) await tx.product.update({ where: { id: parsedId.data }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: `PRODUCT_LOCALE_${publish ? "PUBLISHED" : "UNPUBLISHED"}`, resource: `ProductTranslation:${parsedLocale.data}`, resourceId: parsedId.data } });
  });
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath(locale === "ZH_CN" ? "/zh-CN" : "/en");
  revalidatePath(locale === "ZH_CN" ? "/zh-CN/products" : "/en/products");
}

// 一键翻译（P0b 工厂接入）：中文 name/tagline/description/seoTitle/seoDescription → EN（不发布）
export const translateProductAction = createTranslateAction<{ id: string; translations: { locale: string; name: string; tagline: string | null; description: string | null; seoTitle: string | null; seoDescription: string | null }[] }>({
  permission: "content:write",
  resource: "Product",
  auditAction: "PRODUCT_TRANSLATED",
  module: "product",
  redirectBase: "/dashboard/products",
  findItem: async (tenantId, id) => getDb().product.findFirst({ where: { id, tenantId, deletedAt: null }, include: { translations: true } }),
  getZhTexts: (item) => { const zh = item.translations.find((t) => t.locale === "ZH_CN"); return [zh?.name ?? null, zh?.tagline ?? null, zh?.description ?? null, zh?.seoTitle ?? null, zh?.seoDescription ?? null]; },
  buildEnWrite: async (item, en, tx) => {
    await tx.productTranslation.upsert({ where: { productId_locale: { productId: item.id, locale: "EN" } }, update: { name: en[0], tagline: en[1] || null, description: en[2] || null, seoTitle: en[3] || null, seoDescription: en[4] || null }, create: { productId: item.id, locale: "EN", name: en[0], tagline: en[1] || null, description: en[2] || null, seoTitle: en[3] || null, seoDescription: en[4] || null } });
  },
});
