import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getValidatedSession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { MAX_ROWS } from "@/lib/import/parse-products";

const rowsSchema = z.array(z.object({
  row: z.number().int().min(2).max(MAX_ROWS + 1),
  model: z.string().trim().min(2).max(60),
  categorySlug: z.string().trim().min(1).max(60),
  sku: z.string().trim().min(2).max(80),
  nameZh: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().max(160).optional(),
  taglineZh: z.string().trim().max(200),
  taglineEn: z.string().trim().max(240),
  descriptionZh: z.string().trim().max(5000).optional(),
  descriptionEn: z.string().trim().max(5000).optional(),
  slug: z.string().trim().max(120).refine((v) => !v || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "slug 格式不合法"),
  params: z.array(z.object({ key: z.string().max(60), raw: z.string().max(500) })).max(50),
})).max(MAX_ROWS);

// POST JSON（rows）→ 服务端重新校验后入库（不信任客户端预览结果）
export async function POST(request: Request) {
  const session = await getValidatedSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!can(session.role, "content:write", session.canPublish)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = rowsSchema.safeParse(body?.rows);
  if (!parsed.success || parsed.data.length === 0) return NextResponse.json({ error: "导入数据校验失败" }, { status: 400 });
  const rows = parsed.data;

  const cats = await getDb().productCategory.findMany({
    where: { tenantId: session.tenantId, isActive: true },
    select: { id: true, slug: true, nameZh: true, templates: { orderBy: { version: "desc" }, take: 1, select: { definitions: { select: { id: true, key: true } } } } },
  });
  const categories = cats.map((c) => ({ id: c.id, slug: c.slug, nameZh: c.nameZh, defs: c.templates[0]?.definitions ?? [] }));
  const [models, skus] = await Promise.all([
    getDb().product.findMany({ where: { tenantId: session.tenantId }, select: { model: true } }),
    getDb().productVariant.findMany({ where: { product: { tenantId: session.tenantId } }, select: { sku: true } }),
  ]);
  const existingModels = new Set(models.map((m) => m.model));
  const existingSkus = new Set(skus.map((s) => s.sku));

  // 按 model 分组：一组 = 一个产品事务
  const groups = new Map<string, typeof rows>();
  for (const r of rows) { const g = groups.get(r.model) ?? []; g.push(r); groups.set(r.model, g); }
  const succeeded: { model: string; skus: number }[] = [];
  const failed: { model: string; reason: string }[] = [];

  for (const [model, group] of groups) {
    const first = group[0];
    const category = categories.find((c) => c.slug === first.categorySlug);
    if (!category) { failed.push({ model, reason: "分类不存在" }); continue; }
    if (existingModels.has(model)) { failed.push({ model, reason: "型号已存在" }); continue; }
    if (new Set(group.map((r) => r.sku)).size !== group.length) { failed.push({ model, reason: "组内 SKU 重复" }); continue; }
    if (group.some((r) => existingSkus.has(r.sku))) { failed.push({ model, reason: "SKU 已存在" }); continue; }
    // 纯中文等无 ASCII 的 model 会生成空 slug——回退随机后缀，避免空串入库或 P2002 误导
    const generated = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const slug = first.slug || generated || `p-${randomUUID().slice(0, 8)}`;
    try {
      await getDb().$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            tenantId: session.tenantId, categoryId: category.id, model, slug,
            translations: { create: [
              { locale: "ZH_CN", name: first.nameZh, tagline: first.taglineZh || undefined, description: first.descriptionZh || undefined },
              { locale: "EN", name: first.nameEn || first.nameZh, tagline: first.taglineEn || undefined, description: first.descriptionEn || undefined },
            ] },
            variants: { create: group.map((r, i) => ({ sku: r.sku, name: r.sku, sortOrder: i })) },
          },
        });
        const defByKey = new Map(category.defs.map((d) => [d.key, d.id]));
        for (const r of group) {
          const variant = await tx.productVariant.findFirst({ where: { productId: product.id, sku: r.sku }, select: { id: true } });
          if (!variant) continue;
          for (const p of r.params) {
            const defId = defByKey.get(p.key);
            if (!defId) continue;
            await tx.variantParameterValue.create({ data: { variantId: variant.id, definitionId: defId, valueJson: { raw: p.raw } } });
          }
        }
        await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PRODUCTS_IMPORTED", resource: "Product", resourceId: product.id, metadata: { skus: group.length } } });
      });
      succeeded.push({ model, skus: group.length });
    } catch (error) {
      failed.push({ model, reason: (error as { code?: string }).code === "P2002" ? "型号、slug 或 SKU 冲突" : "入库失败" });
    }
  }
  return NextResponse.json({ succeeded, failed, total: rows.length });
}
