import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseProductWorkbook, type CategoryInfo } from "./parse-products";

const categories: CategoryInfo[] = [
  {
    slug: "wall-washer",
    nameZh: "洗墙灯",
    nameEn: "Wall Washer",
    defs: [
      { key: "power", labelZh: "功率", labelEn: "Power" },
      { key: "beam_angle", labelZh: "光束角", labelEn: "Beam angle" },
    ],
  },
  {
    slug: "flood-light",
    nameZh: "投光灯",
    nameEn: "Flood Light",
    defs: [{ key: "voltage", labelZh: "电压", labelEn: "Voltage" }],
  },
];

async function buildXlsx(rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  for (const row of rows) ws.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const HEADERS = ["型号", "分类", "SKU", "中文名称", "英文名称", "卖点", "tagline", "url别名", "功率", "光束角"];
const baseRow = ["XW-100", "洗墙灯", "XW-100A", "洗墙灯", "Wall Washer", "高光效", "High efficacy", "xw-100", 30, "24°"];

describe("parseProductWorkbook（Excel 导入管线）", () => {
  async function run(rows: (string | number)[][], existing = { models: new Set<string>(), skus: new Set<string>() }) {
    const buffer = await buildXlsx(rows);
    return parseProductWorkbook(buffer, categories, existing);
  }

  it("合法数据：同型号两 SKU 归组、中文表头匹配、参数列正确归入", async () => {
    const preview = await run([HEADERS, baseRow, ["XW-100", "洗墙灯", "XW-100B", "洗墙灯", "Wall Washer", "", "", "xw-100", 60, "45°"]]);
    expect(preview.errors).toBe(0);
    expect(preview.valid).toBe(2);
    expect(preview.rows[0].params).toEqual([{ key: "power", raw: "30" }, { key: "beam_angle", raw: "24°" }]);
    expect(preview.rows[0].categorySlug).toBe("wall-washer");
  });

  it("缺少必填列：直接抛错", async () => {
    await expect(run([["型号", "分类", "SKU"]])).rejects.toThrow("缺少必填列");
  });

  it("行级缺必填值（SKU 为空）：记 error，不影响其他行", async () => {
    const preview = await run([HEADERS, ["XW-100", "洗墙灯", "", "洗墙灯", "Wall Washer"], baseRow]);
    expect(preview.errors).toBe(1);
    expect(preview.issues[0]).toMatchObject({ row: 2, level: "error" });
    expect(preview.valid).toBe(1);
  });

  it("分类不存在：记 error", async () => {
    const preview = await run([HEADERS, ["XW-100", "不存在的分类", "XW-100A", "洗墙灯", "Wall Washer"]]);
    expect(preview.issues[0].message).toContain("分类不存在");
  });

  it("文件内 SKU 重复：第二行记 error", async () => {
    const preview = await run([HEADERS, baseRow, baseRow]);
    expect(preview.issues).toEqual([expect.objectContaining({ row: 3, level: "error", message: expect.stringContaining("文件内 SKU 重复") })]);
  });

  it("与库内已有 model / SKU 冲突：记 error", async () => {
    const p1 = await run([HEADERS, baseRow], { models: new Set(["XW-100"]), skus: new Set() });
    expect(p1.issues[0].message).toContain("产品型号已存在");
    const p2 = await run([HEADERS, baseRow], { models: new Set(), skus: new Set(["XW-100A"]) });
    expect(p2.issues[0].message).toContain("SKU 已存在");
  });

  it("slug 非法（大写/下划线）：记 error", async () => {
    const bad = [...baseRow];
    bad[7] = "XW_100";
    const preview = await run([HEADERS, bad]);
    expect(preview.issues[0].message).toContain("slug");
  });

  it("参数列不属于该分类模板：warning 并忽略该列", async () => {
    const preview = await run([[...HEADERS, "电压"], [...baseRow, 220]]);
    expect(preview.warnings).toBe(1);
    expect(preview.issues[0]).toMatchObject({ level: "warning", message: expect.stringContaining("已忽略") });
    expect(preview.rows[0].params).toHaveLength(2);
  });

  it("参数值超长：warning 并截断到 500 字符", async () => {
    const long = [...baseRow];
    long[8] = "x".repeat(600); // 功率列（index 8）
    const preview = await run([HEADERS, long]);
    expect(preview.warnings).toBe(1);
    expect(preview.rows[0].params[0].raw).toHaveLength(500);
  });

  it("英文表头别名与英文分类名同样可匹配", async () => {
    const preview = await run([
      ["model", "category", "SKU", "name_zh", "name_en", "Power", "Beam angle"],
      ["XW-200", "Wall Washer", "XW-200A", "洗墙灯", "Wall Washer", 40, "24°"],
    ]);
    expect(preview.errors).toBe(0);
    expect(preview.rows[0].params).toEqual([{ key: "power", raw: "40" }, { key: "beam_angle", raw: "24°" }]);
  });
});
