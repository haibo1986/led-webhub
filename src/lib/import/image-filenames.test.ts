import { describe, expect, it } from "vitest";
import { isAllowedImageExt, matchImageFileName } from "./image-filenames";

const MODELS = ["XW30", "XW30-PRO", "AW-100"];

describe("matchImageFileName（zip 文件名约定）", () => {
  it("型号 + 分隔符 + 序号 → IMAGE", () => {
    expect(matchImageFileName("XW30-1.jpg", MODELS)).toEqual({ model: "XW30", role: "IMAGE", fileName: "XW30-1.jpg" });
    expect(matchImageFileName("xw30_2.png", MODELS)).toEqual({ model: "XW30", role: "IMAGE", fileName: "xw30_2.png" });
    expect(matchImageFileName("XW30 正面.jpg", MODELS)).toEqual({ model: "XW30", role: "IMAGE", fileName: "XW30 正面.jpg" });
  });

  it("最长型号前缀优先（XW30-PRO 不被 XW30 截胡）", () => {
    expect(matchImageFileName("XW30-PRO-1.jpg", MODELS)?.model).toBe("XW30-PRO");
  });

  it("含连字符型号同样可匹配", () => {
    expect(matchImageFileName("AW-100-封面.png", MODELS)).toEqual({ model: "AW-100", role: "COVER", fileName: "AW-100-封面.png" });
  });

  it("角色关键字：尺寸图/cad/dimension → CAD；封面/cover → COVER", () => {
    expect(matchImageFileName("XW30-尺寸图.jpg", MODELS)?.role).toBe("CAD");
    expect(matchImageFileName("XW30-cad-02.dwg", MODELS)?.role).toBe("CAD");
    expect(matchImageFileName("XW30 dimension.png", MODELS)?.role).toBe("CAD");
    expect(matchImageFileName("XW30-cover.jpg", MODELS)?.role).toBe("COVER");
    expect(matchImageFileName("XW30-主图.jpg", MODELS)?.role).toBe("COVER");
  });

  it("不匹配任何型号返回 null", () => {
    expect(matchImageFileName("随机文件.jpg", MODELS)).toBeNull();
    expect(matchImageFileName("XW31-1.jpg", MODELS)).toBeNull();
  });
});

describe("isAllowedImageExt（zip 类型白名单）", () => {
  it("图片与工程格式放行，其余拒绝", () => {
    for (const ok of ["a.jpg", "b.jpeg", "c.png", "d.webp", "e.dwg", "f.dxf", "g.step"]) expect(isAllowedImageExt(ok), ok).toBe(true);
    for (const bad of ["a.pdf", "b.exe", "c.xlsx", "d", "e.ies"]) expect(isAllowedImageExt(bad), bad).toBe(false);
  });
});
