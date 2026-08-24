import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE, DEFAULT_NAV, navItemSchema, navigationConfigSchema, resolveHomepage, resolveNavigation, resolveSeo } from "./site-config";

describe("resolveNavigation（导航配置解析）", () => {
  it("null 配置回退到内置默认导航", () => {
    expect(resolveNavigation(null)).toEqual(DEFAULT_NAV);
  });

  it("JSON 损坏/非法（如 href 注入 javascript:）时整体回退默认值", () => {
    expect(resolveNavigation([{ id: "x", type: "link", labelZh: "恶意", labelEn: "evil", href: "javascript:alert(1)", enabled: true }])).toEqual(DEFAULT_NAV);
    expect(resolveNavigation("not-an-array")).toEqual(DEFAULT_NAV);
  });

  it("合法自定义配置原样返回", () => {
    const custom = [{ id: "home", type: "page" as const, page: "home" as const, labelZh: "主页", labelEn: "Main", enabled: true }];
    expect(resolveNavigation(custom)).toEqual(custom);
  });

  it("navItemSchema 拒绝 javascript:/data: 链接与越界标签", () => {
    expect(navItemSchema.safeParse({ id: "x", type: "link", labelZh: "a", labelEn: "a", href: "javascript:alert(1)", enabled: true }).success).toBe(false);
    expect(navItemSchema.safeParse({ id: "x", type: "link", labelZh: "a", labelEn: "a", href: "data:text/html;base64,xxx", enabled: true }).success).toBe(false);
    expect(navItemSchema.safeParse({ id: "x", type: "page", page: "home", labelZh: "a".repeat(21), labelEn: "a", enabled: true }).success).toBe(false);
    expect(navItemSchema.safeParse({ id: "x", type: "link", labelZh: "官网", labelEn: "Site", href: "https://example.com", enabled: true }).success).toBe(true);
    expect(navItemSchema.safeParse({ id: "x", type: "link", labelZh: "内部页", labelEn: "Inner", href: "/resources", enabled: true }).success).toBe(true);
  });

  it("导航项数量上限 12", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ id: `i${i}`, type: "page" as const, page: "home" as const, labelZh: "x", labelEn: "x", enabled: true }));
    expect(navigationConfigSchema.safeParse(many).success).toBe(false);
    expect(navigationConfigSchema.safeParse(many.slice(0, 12)).success).toBe(true);
  });
});

describe("resolveHomepage（首页模块配置解析）", () => {
  it("null 回退到全部显示", () => {
    expect(resolveHomepage(null)).toEqual(DEFAULT_HOMEPAGE);
  });

  it("非法配置（缺失布尔字段）整体回退默认值", () => {
    expect(resolveHomepage({ hero: true })).toEqual(DEFAULT_HOMEPAGE);
    expect(resolveHomepage("broken")).toEqual(DEFAULT_HOMEPAGE);
  });

  it("合法配置保留自定义 hero 文案", () => {
    expect(resolveHomepage({ hero: false, products: true, capability: false, heroTitleZh: "定制标题" })).toEqual({ hero: false, products: true, capability: false, heroTitleZh: "定制标题" });
  });
});

describe("resolveSeo（SEO 默认值解析）", () => {
  it("null 回退为空配置（调用方再回退企业名/简介）", () => {
    expect(resolveSeo(null)).toEqual({});
  });

  it("非法配置整体回退空配置", () => {
    expect(resolveSeo({ defaultTitle: 42 })).toEqual({});
  });

  it("合法配置保留各字段", () => {
    expect(resolveSeo({ defaultTitle: "硕名康照明", defaultDescriptionZh: "专业户外照明", keywordsZh: "LED, 户外灯" })).toEqual({ defaultTitle: "硕名康照明", defaultDescriptionZh: "专业户外照明", keywordsZh: "LED, 户外灯" });
  });
});
