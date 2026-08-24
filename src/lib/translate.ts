// DeepSeek 翻译服务层（P2）：OpenAI 兼容 Chat Completions 协议。
// 凭据 DEEPSEEK_API_KEY 未配置时按钮隐藏（isTranslateConfigured），绝不静默调用外部 API。
const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const TIMEOUT_MS = 30_000;

export function isTranslateConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.DEEPSEEK_API_KEY?.trim());
}

export function translateSystemPrompt(): string {
  return "You are a professional translator for a B2B lighting manufacturer's website. Translate the given Chinese text into concise, professional English suitable for a project case page. Preserve technical terms (LED, IP65, lumen, driver). Output ONLY the translation — no explanations, no quotes, no markdown.";
}

export async function translateToEnglish(text: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: translateSystemPrompt() }, { role: "user", content: text }], temperature: 0.2 }),
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
