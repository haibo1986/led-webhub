// Excel 批量导入的列配置（可扩展层）：
// 每列一个标准 key + 多个别名表头，客户 Excel 表头习惯不同时在此增删别名即可；
// 远期可把本配置迁移为租户级数据库配置，实现「每家客户一套格式」。
export type ImportColumn = { key: string; aliases: string[]; required: boolean; hint: string };

export const PRODUCT_COLUMNS: ImportColumn[] = [
  { key: "model", aliases: ["model", "型号", "产品型号", "model no"], required: true, hint: "产品型号，同型号多行自动归组为一个产品" },
  { key: "category", aliases: ["category", "分类", "产品分类"], required: true, hint: "分类中文名或 slug，如 洗墙灯 / wall-washer" },
  { key: "sku", aliases: ["sku", "SKU", "规格编码"], required: true, hint: "一行一个 SKU" },
  { key: "name_zh", aliases: ["name_zh", "中文名称", "中文名", "产品名称"], required: true, hint: "中文产品名（每个型号首行生效）" },
  { key: "name_en", aliases: ["name_en", "英文名称", "英文名", "product name", "name (en)"], required: false, hint: "English product name（选填，可后台一键翻译）" },
  { key: "tagline_zh", aliases: ["tagline_zh", "中文卖点", "一句话卖点", "卖点"], required: false, hint: "一句话卖点（中文，列表卡片展示）" },
  { key: "tagline_en", aliases: ["tagline_en", "英文卖点", "tagline"], required: false, hint: "Tagline (English)" },
  { key: "description_zh", aliases: ["description_zh", "中文描述", "特性描述", "产品特性", "产品描述"], required: false, hint: "产品特性描述（中文，详情页介绍正文，可换行）" },
  { key: "description_en", aliases: ["description_en", "英文描述", "product description", "description"], required: false, hint: "Product description (English)" },
  { key: "slug", aliases: ["slug", "url别名", "url 别名"], required: false, hint: "URL 别名（高级，不填自动生成）" },
];

export function matchHeader(header: string, column: ImportColumn): boolean {
  const h = header.trim().toLowerCase();
  return column.aliases.some((a) => a.toLowerCase() === h);
}

export function matchParamHeader(header: string, def: { key: string; labelZh: string; labelEn: string | null }): boolean {
  const h = header.trim().toLowerCase();
  return def.key.toLowerCase() === h || def.labelZh.toLowerCase() === h || (def.labelEn ?? "").toLowerCase() === h;
}
