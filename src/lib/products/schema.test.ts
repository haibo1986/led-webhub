import { describe, expect, it } from "vitest";
import { parseProductForm } from "./schema";

// 审计 #5 相关回归：表单校验（SKU 去重 refine、长度与 slug 约束）的运行时行为。
function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("categoryId", overrides.categoryId ?? "cat-1");
  fd.set("model", overrides.model ?? "XW-100");
  fd.set("slug", overrides.slug ?? "xw-100");
  fd.set("nameZh", overrides.nameZh ?? "投光灯");
  fd.set("nameEn", overrides.nameEn ?? "Flood Light");
  fd.set("skus", overrides.skus ?? "XW-100A\nXW-100B");
  return fd;
}

describe("parseProductForm", () => {
  it("合法表单解析成功，SKU 按换行拆分", () => {
    const r = parseProductForm(form());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.skus).toEqual(["XW-100A", "XW-100B"]);
  });

  it("SKU 列表内重复项被 reject（审计 #5：SKU 列表先 Set 去重的运行时兜底）", () => {
    const r = parseProductForm(form({ skus: "XW-100A\nXW-100A" }));
    expect(r.success).toBe(false);
  });

  it("slug 含大写或下划线被 reject", () => {
    expect(parseProductForm(form({ slug: "XW-100" })).success).toBe(false);
    expect(parseProductForm(form({ slug: "xw_100" })).success).toBe(false);
  });

  it("model 长度越界被 reject（<2 或 >60）", () => {
    expect(parseProductForm(form({ model: "X" })).success).toBe(false);
    expect(parseProductForm(form({ model: "x".repeat(61) })).success).toBe(false);
  });

  it("SKU 为空（纯空白输入）被 reject", () => {
    expect(parseProductForm(form({ skus: " \n " })).success).toBe(false);
  });

  it("逗号分隔的 SKU 同样被正确拆分", () => {
    const r = parseProductForm(form({ skus: "A-1,B-2" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.skus).toEqual(["A-1", "B-2"]);
  });

  it("标签按逗号/中文逗号/换行拆分，缺省为空数组，超过 10 个被拒绝", () => {
    const fd = form();
    fd.set("tags", "户外，洗墙,IP65\n防水");
    const r = parseProductForm(fd);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tags).toEqual(["户外", "洗墙", "IP65", "防水"]);

    const noTags = parseProductForm(form());
    expect(noTags.success).toBe(true);
    if (noTags.success) expect(noTags.data.tags).toEqual([]);

    const tooMany = form();
    tooMany.set("tags", Array.from({ length: 11 }, (_, i) => `t${i}`).join(","));
    expect(parseProductForm(tooMany).success).toBe(false);
  });
});
