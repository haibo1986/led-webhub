import { describe, expect, it } from "vitest";
import { collectFilterValues, filterHref, parseParamFilters, toggleFilter } from "./product-filter";

describe("parseParamFilters（URL 参数提取）", () => {
  it("提取 f_ 前缀参数为 key/value 对", () => {
    const sp = new URLSearchParams("?category=wall-washer&f_power=30&f_beam_angle=24°&page=2");
    expect(parseParamFilters(sp)).toEqual([{ key: "power", value: "30" }, { key: "beam_angle", value: "24°" }]);
  });

  it("非法 key（大写/超长/非字母开头）与空值被丢弃", () => {
    const sp = new URLSearchParams();
    sp.set("f_POWER", "30");
    sp.set("f_" + "a".repeat(50), "x");
    sp.set("f_1bad", "x");
    sp.set("f_ok", "  ");
    sp.set("other", "x");
    expect(parseParamFilters(sp)).toEqual([]);
  });

  it("超长值被丢弃", () => {
    const sp = new URLSearchParams();
    sp.set("f_power", "x".repeat(201));
    expect(parseParamFilters(sp)).toEqual([]);
  });

  it("同名参数多值：后者覆盖前者（防 AND 组合恒空）", () => {
    const sp = new URLSearchParams("?f_power=18&f_power=24&f_ip_rating=IP65");
    expect(parseParamFilters(sp)).toEqual([{ key: "power", value: "24" }, { key: "ip_rating", value: "IP65" }]);
  });
});

describe("filterHref（查询串构造）", () => {
  it("保留 category/q，丢弃 page 与旧 f_ 参数，写入新筛选", () => {
    const sp = new URLSearchParams("?category=wall-washer&q=线性&page=3&f_old=1");
    const out = new URLSearchParams(filterHref(sp, [{ key: "power", value: "30" }]));
    expect(out.get("category")).toBe("wall-washer");
    expect(out.get("q")).toBe("线性");
    expect(out.get("page")).toBeNull();
    expect(out.get("f_old")).toBeNull();
    expect(out.get("f_power")).toBe("30");
  });

  it("空筛选数组即清除全部 f_ 参数", () => {
    const sp = new URLSearchParams("?f_power=30&f_beam_angle=24");
    expect(filterHref(sp, [])).toBe("");
  });
});

describe("toggleFilter（单值切换）", () => {
  it("未选则加入（同 key 替换），已选则取消", () => {
    expect(toggleFilter([], "power", "30")).toEqual([{ key: "power", value: "30" }]);
    expect(toggleFilter([{ key: "power", value: "30" }], "power", "60")).toEqual([{ key: "power", value: "60" }]);
    expect(toggleFilter([{ key: "power", value: "30" }, { key: "ip_rating", value: "IP65" }], "power", "30")).toEqual([{ key: "ip_rating", value: "IP65" }]);
  });
});

describe("collectFilterValues（值聚合去重）", () => {
  it("按定义分组、去重、中文数字感知排序、限量 20", () => {
    const items = [
      { definitionId: "d1", raw: "36" },
      { definitionId: "d1", raw: "18" },
      { definitionId: "d1", raw: "36" },
      { definitionId: "d2", raw: "IP65" },
    ];
    const map = collectFilterValues(items, ["d1", "d2"]);
    expect(map.get("d1")).toEqual(["18", "36"]);
    expect(map.get("d2")).toEqual(["IP65"]);
  });

  it("未定义的定义 id 返回空数组；超限量截断到 20", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ definitionId: "d1", raw: `v${i}` }));
    const map = collectFilterValues(many, ["d1", "d-missing"]);
    expect(map.get("d1")).toHaveLength(20);
    expect(map.get("d-missing")).toEqual([]);
  });
});
