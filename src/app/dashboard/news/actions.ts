"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { tenantScope } from "@/lib/tenant/scope";
import { createTranslateAction } from "@/lib/translate-factory";
import { getDb } from "@/lib/db";

const schema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().trim().min(2).max(60),
  titleZh: z.string().trim().min(2).max(180),
  titleEn: z.string().trim().min(2).max(200),
  excerptZh: z.string().trim().max(360),
  excerptEn: z.string().trim().max(420),
  bodyZh: z.string().trim().max(10000),
  bodyEn: z.string().trim().max(10000),
});

const keys = ["slug", "category", "titleZh", "titleEn", "excerptZh", "excerptEn", "bodyZh", "bodyEn"] as const;
function parse(formData: FormData) { return schema.safeParse(Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]))); }

export async function createNewsAction(formData: FormData) {
  const session = await requirePermission("content:write");
  const parsed = parse(formData);
  if (!parsed.success) redirect("/dashboard/news/new?error=invalid");
  const d = parsed.data;
  const dup = await getDb().newsPost.findFirst({ where: { tenantId: session.tenantId, slug: d.slug }, select: { id: true } });
  if (dup) redirect("/dashboard/news/new?error=duplicate");
  let post;
  try {
    post = await getDb().newsPost.create({ data: { tenantId: session.tenantId, slug: d.slug, category: d.category, translations: { create: [{ locale: "ZH_CN", title: d.titleZh, excerpt: d.excerptZh, body: d.bodyZh }, { locale: "EN", title: d.titleEn, excerpt: d.excerptEn, body: d.bodyEn }] } } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") redirect("/dashboard/news/new?error=duplicate");
    throw error;
  }
  await getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "NEWS_CREATED", resource: "NewsPost", resourceId: post.id } });
  redirect(`/dashboard/news/${post.id}?created=1`);
}

export async function updateNewsAction(id: string, formData: FormData) {
  const session = await requirePermission("content:write");
  const parsedId = z.string().trim().max(60).safeParse(id);
  if (!parsedId.success) throw new Error("INVALID_INPUT");
  const parsed = parse(formData);
  if (!parsed.success) redirect(`/dashboard/news/${parsedId.data}?error=invalid`);
  const post = await getDb().newsPost.findFirst({ where: { id: parsedId.data, tenantId: session.tenantId, deletedAt: null } });
  if (!post) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const d = parsed.data;
  const dup = await getDb().newsPost.findFirst({ where: { tenantId: session.tenantId, slug: d.slug, NOT: { id: parsedId.data } }, select: { id: true } });
  if (dup) redirect(`/dashboard/news/${parsedId.data}?error=duplicate`);
  try {
    await getDb().$transaction(async (tx) => {
      await tx.newsPost.update({ where: { id: parsedId.data }, data: { slug: d.slug, category: d.category } });
      for (const tr of [["ZH_CN", d.titleZh, d.excerptZh, d.bodyZh], ["EN", d.titleEn, d.excerptEn, d.bodyEn]] as const) {
        await tx.newsPostTranslation.upsert({ where: { postId_locale: { postId: parsedId.data, locale: tr[0] } }, update: { title: tr[1], excerpt: tr[2], body: tr[3] }, create: { postId: parsedId.data, locale: tr[0], title: tr[1], excerpt: tr[2], body: tr[3] } });
      }
      await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "NEWS_UPDATED", resource: "NewsPost", resourceId: parsedId.data } });
    });
    revalidatePath(`/dashboard/news/${parsedId.data}`);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") redirect(`/dashboard/news/${parsedId.data}?error=duplicate`);
    throw error;
  }
  redirect(`/dashboard/news/${parsedId.data}?saved=1`);
}

export async function setNewsStatusAction(id: string, locale: "ZH_CN" | "EN", publish: boolean) {
  const parsedId = z.string().trim().max(60).safeParse(id);
  const parsedLocale = z.enum(["ZH_CN", "EN"]).safeParse(locale);
  if (!parsedId.success || !parsedLocale.success || typeof publish !== "boolean") throw new Error("INVALID_INPUT");
  const session = await requirePermission("content:publish");
  const post = await getDb().newsPost.findFirst({ where: tenantScope(session.tenantId, { id: parsedId.data, deletedAt: null }), include: { translations: { where: { locale: parsedLocale.data }, take: 1 } } });
  if (!post?.translations[0]) throw new Error("TENANT_BOUNDARY_VIOLATION");
  // 发布守卫：标题为空（未填写/未翻译）不可发布该语言
  if (publish && !post.translations[0].title.trim()) redirect(`/dashboard/news/${parsedId.data}?translated=empty`);
  await getDb().$transaction([
    getDb().newsPostTranslation.update({ where: { id: post.translations[0].id }, data: { isPublished: publish } }),
    getDb().newsPost.update({ where: { id: parsedId.data }, data: publish ? { status: "PUBLISHED", publishedAt: new Date() } : {} }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: `NEWS_${parsedLocale.data}_${publish ? "PUBLISHED" : "UNPUBLISHED"}`, resource: "NewsPost", resourceId: parsedId.data } }),
  ]);
  revalidatePath(`/dashboard/news/${parsedId.data}`);
  revalidatePath(parsedLocale.data === "ZH_CN" ? "/zh-CN/news" : "/en/news");
}

export async function deleteNewsAction(id: string) {
  const parsedId = z.string().trim().max(60).safeParse(id);
  if (!parsedId.success) throw new Error("INVALID_INPUT");
  const session = await requirePermission("content:write");
  const post = await getDb().newsPost.findFirst({ where: tenantScope(session.tenantId, { id: parsedId.data, deletedAt: null }) });
  if (!post) throw new Error("TENANT_BOUNDARY_VIOLATION");
  await getDb().$transaction([
    getDb().newsPost.update({ where: { id: parsedId.data }, data: { deletedAt: new Date(), status: "ARCHIVED" } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "NEWS_DELETED", resource: "NewsPost", resourceId: parsedId.data } }),
  ]);
  redirect("/dashboard/news?deleted=1");
}

// 一键翻译（P1 工厂接入）：中文 title/excerpt/body → EN（不发布）
export const translateNewsAction = createTranslateAction<{ id: string; translations: { locale: string; title: string; excerpt: string | null; body: string | null }[] }>({
  permission: "content:write",
  resource: "NewsPost",
  auditAction: "NEWS_TRANSLATED",
  module: "news",
  redirectBase: "/dashboard/news",
  findItem: async (tenantId, id) => getDb().newsPost.findFirst({ where: { id, tenantId, deletedAt: null }, include: { translations: true } }),
  getZhTexts: (item) => { const zh = item.translations.find((t) => t.locale === "ZH_CN"); return [zh?.title ?? null, zh?.excerpt ?? null, zh?.body ?? null]; },
  buildEnWrite: async (item, en, tx) => {
    await tx.newsPostTranslation.upsert({ where: { postId_locale: { postId: item.id, locale: "EN" } }, update: { title: en[0], excerpt: en[1] || null, body: en[2] || null }, create: { postId: item.id, locale: "EN", title: en[0], excerpt: en[1] || null, body: en[2] || null } });
  },
});
