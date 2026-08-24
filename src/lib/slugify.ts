import { pinyin } from "pinyin-pro";

// 中文标题 → URL slug：英文/数字块整体保留，中文逐字转拼音，连字符连接。
// 返回空串表示无法生成（调用方回退随机后缀）。
export function slugifyZh(text: string, maxLen = 60): string {
  const tokens: string[] = [];
  for (const part of text.match(/[a-zA-Z0-9]+|[^\s]/g) ?? []) {
    if (/^[a-zA-Z0-9]+$/.test(part)) {
      tokens.push(part);
      continue;
    }
    for (const ch of part) tokens.push(pinyin(ch, { toneType: "none" }));
  }
  const slug = tokens
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLen).replace(/-+$/g, "");
}
