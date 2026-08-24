import { NextResponse } from "next/server";
import { getValidatedSession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { parseProductWorkbook, type CategoryInfo } from "@/lib/import/parse-products";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// POST multipart（file）→ 解析与校验预览（不写库）
export async function POST(request: Request) {
  const session = await getValidatedSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!can(session.role, "content:write", session.canPublish)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "文件需在 5MB 以内" }, { status: 400 });

  const cats = await getDb().productCategory.findMany({
    where: { tenantId: session.tenantId, isActive: true },
    select: { slug: true, nameZh: true, nameEn: true, templates: { orderBy: { version: "desc" }, take: 1, select: { definitions: { select: { key: true, labelZh: true, labelEn: true } } } } },
  });
  const categories: CategoryInfo[] = cats.map((c) => ({ slug: c.slug, nameZh: c.nameZh, nameEn: c.nameEn, defs: c.templates[0]?.definitions ?? [] }));
  const [models, skus] = await Promise.all([
    getDb().product.findMany({ where: { tenantId: session.tenantId }, select: { model: true } }),
    getDb().productVariant.findMany({ where: { product: { tenantId: session.tenantId } }, select: { sku: true } }),
  ]);
  try {
    const preview = await parseProductWorkbook(Buffer.from(await file.arrayBuffer()), categories, { models: new Set(models.map((m) => m.model)), skus: new Set(skus.map((s) => s.sku)) });
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "解析失败" }, { status: 422 });
  }
}
