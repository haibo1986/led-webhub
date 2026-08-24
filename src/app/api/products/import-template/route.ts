import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getValidatedSession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";

// GET ?category=<slug> → 下载该分类的空白导入模板（表头 + 说明行 + 示例行）
export async function GET(request: Request) {
  const session = await getValidatedSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!can(session.role, "content:write", session.canPublish)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const categorySlug = new URL(request.url).searchParams.get("category") ?? "";
  const category = await getDb().productCategory.findFirst({
    where: { tenantId: session.tenantId, slug: categorySlug, isActive: true },
    include: { templates: { orderBy: { version: "desc" }, take: 1, include: { definitions: { orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }] } } } },
  });
  if (!category) return NextResponse.json({ error: "分类不存在" }, { status: 404 });
  const defs = category.templates[0]?.definitions ?? [];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("产品导入");
  sheet.columns = [
    { header: "model", width: 16 }, { header: "category", width: 14 }, { header: "sku", width: 18 },
    { header: "name_zh", width: 26 }, { header: "name_en", width: 26 },
    { header: "tagline_zh", width: 26 }, { header: "tagline_en", width: 26 }, { header: "slug", width: 24 },
    ...defs.map((d) => ({ header: d.key, width: 16 })),
  ];
  const sample = {
    model: "示例型号", category: category.nameZh, sku: "示例型号-01",
    name_zh: "示例中文产品名", name_en: "Sample product name",
    tagline_zh: "一句话卖点", tagline_en: "One-line tagline", slug: "sample-model",
  };
  sheet.addRow([sample.model, sample.category, sample.sku, sample.name_zh, sample.name_en, sample.tagline_zh, sample.tagline_en, sample.slug, ...defs.map(() => "示例值")]);
  sheet.addRow(["（必填）同型号多行归组", "（必填）分类名或 slug", "（必填）一行一个 SKU", "（必填）中文产品名", "（必填）English name", "选填", "选填", "选填：不填自动生成", ...defs.map((d) => `${d.labelZh}${d.labelEn ? " / " + d.labelEn : ""}${d.unit ? `（${d.unit}）` : ""}${d.isRequired ? "（必填）" : ""}`)]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(3).font = { italic: true, color: { argb: "FF888888" } };

  const buf = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${category.nameZh}-产品导入模板.xlsx`)}`,
    },
  });
}
