import { describe, expect, it } from "vitest";
import { slugifyZh } from "./slugify";

describe("slugifyZh（中文标题 → 拼音 slug）", () => {
  it("纯中文标题逐字拼音连字符", () => {
    expect(slugifyZh("深圳万象城照明")).toBe("shen-zhen-wan-xiang-cheng-zhao-ming");
  });

  it("中英混合：英文原样保留", () => {
    expect(slugifyZh("LED 深圳项目")).toBe("led-shen-zhen-xiang-mu");
  });

  it("标点与多余连字符归一化", () => {
    expect(slugifyZh("深圳——万象城！！")).toBe("shen-zhen-wan-xiang-cheng");
  });

  it("超长截断到 maxLen 且不保留尾部连字符", () => {
    expect(slugifyZh("深".repeat(50), 20).length).toBeLessThanOrEqual(20);
    expect(slugifyZh("深".repeat(50), 20).endsWith("-")).toBe(false);
  });

  it("无法生成时返回空串", () => {
    expect(slugifyZh("！！")).toBe("");
  });
});
