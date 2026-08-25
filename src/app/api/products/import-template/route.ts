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
    { header: "tagline_zh", width: 26 }, { header: "tagline_en", width: 26 },
    { header: "description_zh", width: 46 }, { header: "description_en", width: 46 },
    ...defs.map((d) => ({ header: d.key, width: 16 })),
  ];
  const sample = {
    model: "XW30", category: category.nameZh, sku: "XW30-18W",
    name_zh: "窄体线性洗墙灯", name_en: "Slim Linear Wall Washer",
    tagline_zh: "连续、均匀、精准的立面光", tagline_en: "Continuous and precise facade illumination",
    description_zh: "一体化铝合金灯体，多种光学配光可选，适合建筑立面连续洗墙。",
    description_en: "Integrated aluminum housing with selectable optics for continuous facade washing.",
  };
  sheet.addRow([sample.model, sample.category, sample.sku, sample.name_zh, sample.name_en, sample.tagline_zh, sample.tagline_en, sample.description_zh, sample.description_en, ...defs.map(() => "示例值")]);
  sheet.addRow([sample.model, sample.category, "XW30-24W", "", "", "", "", "", "", ...defs.map(() => "示例值")]);
  sheet.addRow([sample.model, sample.category, "XW30-36W", "", "", "", "", "", "", ...defs.map(() => "示例值")]);
  sheet.addRow(["（必填）同型号多行归组，一行一个 SKU", "（必填）分类名或 slug", "（必填）SKU 编码", "（必填）中文产品名", "选填：可后台一键翻译", "选填：列表卡片卖点", "选填", "选填：详情页介绍正文，可换行", "选填", ...defs.map((d) => `${d.labelZh}${d.labelEn ? " / " + d.labelEn : ""}${d.unit ? `（${d.unit}）` : ""}${d.isRequired ? "（必填）" : ""}`)]);
  sheet.getRow(1).font = { bold: true };
  for (const r of [4, 5, 6]) sheet.getRow(r).font = { italic: true, color: { argb: "FF888888" } };

  const buf = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${category.nameZh}-产品导入模板.xlsx`)}`,
    },
  });
}
