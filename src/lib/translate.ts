// DeepSeek 翻译服务层：OpenAI 兼容 Chat Completions 协议。
// 凭据 DEEPSEEK_API_KEY 未配置时翻译入口隐藏（isTranslateConfigured），绝不静默调用外部 API。
const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
const TIMEOUT_MS = 30_000;
// 成本估算单价（元/百万 tokens，输入输出混合保守值）；可用 TRANSLATE_PRICE_PER_1M_TOKENS 覆盖
const PRICE_PER_1M_TOKENS = Number(process.env.TRANSLATE_PRICE_PER_1M_TOKENS ?? "4");

export function isTranslateConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.DEEPSEEK_API_KEY?.trim());
}

// 各模块语境化 system prompt（统一保留 LED 行业术语与纯输出约束）
export type TranslateModule = "case" | "product" | "news" | "settings" | "category" | "parameter";

const MODULE_CONTEXT: Record<TranslateModule, string> = {
  case: "a project case page",
  product: "a product listing (name, one-line tagline, description and SEO fields) in a lighting catalog",
  news: "a company news article (title, excerpt and body)",
  settings: "an enterprise profile / website settings copy",
  category: "a product category name in a lighting catalog",
  parameter: "a technical parameter label in a lighting specification sheet",
};

export function translateSystemPrompt(module: TranslateModule = "case"): string {
  return `You are a professional translator for a B2B lighting manufacturer's website. Translate the given Chinese text into concise, professional English suitable for ${MODULE_CONTEXT[module]}. Preserve technical terms (LED, IP65, lumen, driver, CRI, CCT) and units. Output ONLY the translation — no explanations, no quotes, no markdown.`;
}

export async function translateToEnglish(text: string, opts?: { module?: TranslateModule }): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: translateSystemPrompt(opts?.module) }, { role: "user", content: text }], temperature: 0.2 }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`DeepSeek API ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Empty translation response");
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

// 成本预估：中文按 1 字符≈1 token 保守折算，输入+输出双计。仅用于 UI 提示，非精确账单。
export function estimateCost(texts: string[]): { chars: number; tokens: number; costYuan: number } {
  const chars = texts.reduce((sum, t) => sum + t.length, 0);
  const tokens = chars + Math.ceil(chars * 0.8);
  return { chars, tokens, costYuan: (tokens / 1_000_000) * PRICE_PER_1M_TOKENS };
}
