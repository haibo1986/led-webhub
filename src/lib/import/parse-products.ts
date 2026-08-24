import ExcelJS from "exceljs";
import { PRODUCT_COLUMNS, matchHeader, matchParamHeader } from "./columns";

// 解析与校验管线（纯函数，供 import-parse / import-confirm 两个路由复用，后续测试基建直接覆盖）
export type ParamDef = { key: string; labelZh: string; labelEn: string | null };
export type CategoryInfo = { slug: string; nameZh: string; nameEn: string | null; defs: ParamDef[] };
export type ParsedRow = {
  row: number;
  model: string;
  categorySlug: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  taglineZh: string;
  taglineEn: string;
  slug: string;
  params: { key: string; raw: string }[];
};
export type Issue = { row: number; level: "error" | "warning"; message: string };
export type Preview = { rows: ParsedRow[]; issues: Issue[]; valid: number; warnings: number; errors: number };

export const MAX_ROWS = 1000;
const MAX_PARAM_LEN = 500;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function parseProductWorkbook(
  buffer: Buffer,
  categories: CategoryInfo[],
  existing: { models: Set<string>; skus: Set<string> },
): Promise<Preview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("工作簿中没有工作表");

  // 表头识别：基础列 + 参数列（参数列按所有分类模板的 key/中文标签/英文标签匹配）
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => { headers[col - 1] = String(cell.text ?? cell.value ?? "").trim(); });
  const baseMap: { index: number; key: string }[] = [];
  const paramMap: { index: number; key: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    const base = PRODUCT_COLUMNS.find((c) => matchHeader(h, c));
    if (base) { baseMap.push({ index: i, key: base.key }); continue; }
    const paramDef = categories.flatMap((c) => c.defs).find((d) => matchParamHeader(h, d));
    if (paramDef) paramMap.push({ index: i, key: paramDef.key });
    // 未识别的列：宽松忽略，不阻塞导入
  }
  const missing = PRODUCT_COLUMNS.filter((c) => c.required && !baseMap.some((m) => m.key === c.key));
  if (missing.length) throw new Error(`缺少必填列: ${missing.map((c) => c.key).join(", ")}`);

  const issues: Issue[] = [];
  const rows: ParsedRow[] = [];
  const seenSkus = new Set<string>();
  const rowLimit = Math.min(sheet.rowCount, MAX_ROWS + 1);
  if (sheet.rowCount > MAX_ROWS + 1) issues.push({ row: MAX_ROWS + 1, level: "warning", message: `文件超过 ${MAX_ROWS} 行数据，仅处理前 ${MAX_ROWS} 行` });
  for (let r = 2; r <= rowLimit; r++) {
    const row = sheet.getRow(r);
    const get = (index: number) => {
      const cell = row.getCell(index + 1);
      const v = cell.text ?? cell.value;
      return v == null ? "" : String(v).trim();
    };
    const base: Record<string, string> = {};
    for (const m of baseMap) base[m.key] = get(m.index);

    const missingRequired = PRODUCT_COLUMNS.filter((c) => c.required && !base[c.key]).map((c) => c.key);
    if (missingRequired.length) { issues.push({ row: r, level: "error", message: `缺少必填列: ${missingRequired.join(", ")}` }); continue; }

    const category = categories.find((c) => c.slug === base.category.toLowerCase() || c.nameZh === base.category || c.nameEn === base.category);
    if (!category) { issues.push({ row: r, level: "error", message: `分类不存在: ${base.category}` }); continue; }
    if (seenSkus.has(base.sku)) { issues.push({ row: r, level: "error", message: `文件内 SKU 重复: ${base.sku}` }); continue; }
    seenSkus.add(base.sku);
    if (existing.models.has(base.model)) { issues.push({ row: r, level: "error", message: `产品型号已存在: ${base.model}` }); continue; }
    if (existing.skus.has(base.sku)) { issues.push({ row: r, level: "error", message: `SKU 已存在: ${base.sku}` }); continue; }

    if (base.model.length < 2 || base.model.length > 60) { issues.push({ row: r, level: "error", message: "model 长度需 2-60 字符" }); continue; }
    if (base.sku.length < 2 || base.sku.length > 80) { issues.push({ row: r, level: "error", message: "SKU 长度需 2-80 字符" }); continue; }
    if (base.slug && !SLUG_RE.test(base.slug)) { issues.push({ row: r, level: "error", message: "slug 只允许小写字母、数字和连字符" }); continue; }

    const params: { key: string; raw: string }[] = [];
    for (const p of paramMap) {
      const raw = get(p.index);
      if (!raw) continue;
      if (!category.defs.some((d) => d.key === p.key)) { issues.push({ row: r, level: "warning", message: `参数列 ${p.key} 不属于分类「${category.nameZh}」模板，已忽略` }); continue; }
      if (raw.length > MAX_PARAM_LEN) issues.push({ row: r, level: "warning", message: `参数 ${p.key} 超过 ${MAX_PARAM_LEN} 字符，已截断` });
      params.push({ key: p.key, raw: raw.slice(0, MAX_PARAM_LEN) });
    }
    rows.push({ row: r, model: base.model, categorySlug: category.slug, sku: base.sku, nameZh: base.name_zh, nameEn: base.name_en, taglineZh: base.tagline_zh ?? "", taglineEn: base.tagline_en ?? "", slug: base.slug ?? "", params });
  }
  return { rows, issues, valid: rows.length, warnings: issues.filter((i) => i.level === "warning").length, errors: issues.filter((i) => i.level === "error").length };
}
