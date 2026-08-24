import { afterEach, describe, expect, it, vi } from "vitest";
import { isTranslateConfigured, translateSystemPrompt, translateToEnglish } from "./translate";

describe("isTranslateConfigured", () => {
  it("无 DEEPSEEK_API_KEY 或空串返回 false", () => {
    expect(isTranslateConfigured({})).toBe(false);
    expect(isTranslateConfigured({ DEEPSEEK_API_KEY: "  " })).toBe(false);
    expect(isTranslateConfigured({ DEEPSEEK_API_KEY: "sk-xxx" })).toBe(true);
  });
});

describe("translateSystemPrompt", () => {
  it("包含专业术语保留与纯输出约束", () => {
    const prompt = translateSystemPrompt();
    expect(prompt).toContain("LED");
    expect(prompt.toLowerCase()).toContain("only the translation");
  });
});

describe("translateToEnglish", () => {
  const originalEnv = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    globalThis.fetch = vi.fn() as never;
    process.env.DEEPSEEK_API_KEY = originalEnv;
  });

  it("未配置 key 直接抛错（不发起网络调用）", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(translateToEnglish("测试")).rejects.toThrow("not configured");
  });

  it("调用 API 并返回翻译结果", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Facade lighting for the civic center" } }] }), { status: 200 }));
    globalThis.fetch = fetchMock as never;
    const result = await translateToEnglish("城市文化中心立面照明");
    expect(result).toBe("Facade lighting for the civic center");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  });

  it("非 2xx 响应抛错", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 401 })) as never;
    await expect(translateToEnglish("测试")).rejects.toThrow("DeepSeek API 401");
  });

  it("空响应抛错", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })) as never;
    await expect(translateToEnglish("测试")).rejects.toThrow("Empty translation");
  });
});
