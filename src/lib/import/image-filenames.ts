// zip 图片包的文件名约定匹配（纯函数）：
// 「型号前缀 + 分隔符(-/_/空格) + 任意描述 + 扩展名」→ 匹配产品；
// 描述部分含角色关键字：cad/尺寸图/工程图/dimension → CAD（尺寸图）、cover/封面/主图 → COVER、默认 IMAGE。
// 多个型号前缀匹配时取最长者（防 XW 误配 XW30）。
export type ImageFileMatch = { model: string; role: "IMAGE" | "CAD" | "COVER"; fileName: string };

export function matchImageFileName(fileName: string, models: string[]): ImageFileMatch | null {
  const base = fileName.toLowerCase().replace(/\.[a-z0-9]{1,8}$/, "");
  let best: string | null = null;
  for (const model of models) {
    const lm = model.toLowerCase();
    if (base === lm || base.startsWith(lm + "-") || base.startsWith(lm + "_") || base.startsWith(lm + " ")) {
      if (!best || lm.length > best.toLowerCase().length) best = model;
    }
  }
  if (!best) return null;
  const rest = base.slice(best.toLowerCase().length);
  if (/(cad|尺寸图|工程图|dimension)/.test(rest)) return { model: best, role: "CAD", fileName };
  if (/(cover|封面|主图)/.test(rest)) return { model: best, role: "COVER", fileName };
  return { model: best, role: "IMAGE", fileName };
}

// zip 内允许的文件类型（图片 + 尺寸图工程格式）；其余计入 unmatched
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".dwg", ".dxf", ".step"]);
export function isAllowedImageExt(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return false;
  return ALLOWED_EXTS.has(fileName.slice(dot).toLowerCase());
}
