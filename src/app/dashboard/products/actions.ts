"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";

const productSchema = z.object({ categoryId: z.string().min(1), model: z.string().trim().min(2).max(60), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), nameZh: z.string().trim().min(2).max(120), nameEn: z.string().trim().min(2).max(160), taglineZh: z.string().trim().max(200), taglineEn: z.string().trim().max(240), skus: z.array(z.string().trim().min(2).max(80)).min(1).max(30).refine((items) => new Set(items).size === items.length, { message: "SKU 不允许重复" }) });

function parse(formData: FormData) {
  return productSchema.safeParse({ categoryId: formData.get("categoryId"), model: formData.get("model"), slug: formData.get("slug"), nameZh: formData.get("nameZh"), nameEn: formData.get("nameEn"), taglineZh: formData.get("taglineZh") ?? "", taglineEn: formData.get("taglineEn") ?? "", skus: String(formData.get("skus") ?? "").split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean) });
}

export async function createProductAction(formData: FormData) {
  const session = await requirePermission("content:write"); const parsed = parse(formData);
  if (!parsed.success) redirect("/dashboard/products/new?error=invalid");
  const category = await getDb().productCategory.findFirst({ where: { id: parsed.data.categoryId, tenantId: session.tenantId, isActive: true }, select: { id: true } });
  if (!category) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const duplicate = await getDb().product.findFirst({ where: { tenantId: session.tenantId, OR: [{ slug: parsed.data.slug }, { model: parsed.data.model }] }, select: { id: true } });
  if (duplicate) redirect("/dashboard/products/new?error=duplicate");
  let product;
  try {
    product = await getDb().product.create({ data: { tenantId: session.tenantId, categoryId: category.id, model: parsed.data.model, slug: parsed.data.slug, translations: { create: [{ locale: "ZH_CN", name: parsed.data.nameZh, tagline: parsed.data.taglineZh }, { locale: "EN", name: parsed.data.nameEn, tagline: parsed.data.taglineEn }] }, variants: { create: parsed.data.skus.map((sku, i) => ({ sku, name: sku, sortOrder: i })) } } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") redirect("/dashboard/products/new?error=duplicate");
    throw error;
  }
  await getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PRODUCT_CREATED", resource: "Product", resourceId: product.id } });
  revalidatePath("/dashboard/products"); redirect(`/dashboard/products/${product.id}?created=1`);
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
      const toDelete = existingVariants.filter((v) => !parsed.data.skus.includes(v.sku)).map((v) => v.id);
      const toCreate = parsed.data.skus.filter((sku) => !existingVariants.some((v) => v.sku === sku));
      if (toDelete.length) await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
      for (const [i, sku] of parsed.data.skus.entries()) await tx.productVariant.updateMany({ where: { productId, sku, id: { notIn: toDelete } }, data: { sortOrder: i } });
      if (toCreate.length) await tx.productVariant.createMany({ data: toCreate.map((sku) => ({ productId, sku, name: sku, sortOrder: parsed.data.skus.indexOf(sku) })) });
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
    select: { id: true },
  });
  if (!translation) throw new Error("TENANT_BOUNDARY_VIOLATION");
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
