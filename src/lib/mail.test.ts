import { describe, expect, it, vi } from "vitest";
import { isMailConfigured, loadMailConfig, renderInquiryMail, sendMail } from "./mail";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "x" }),
      close: vi.fn(),
    })),
  },
}));
import nodemailer from "nodemailer";

const fullEnv = { SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "notify@example.com", SMTP_PASS: "secret", SMTP_FROM: "notify@example.com" };

describe("loadMailConfig（SMTP 配置解析）", () => {
  it("完整配置正常解析，secure 按 SMTP_SECURE 布尔解析", () => {
    expect(loadMailConfig(fullEnv)).toEqual({ host: "smtp.example.com", port: 465, secure: true, user: "notify@example.com", pass: "secret", from: "notify@example.com" });
  });

  it("缺任一必填项返回 null（优雅降级，不发送）", () => {
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const) {
      const env: Record<string, string> = { ...fullEnv };
      delete env[key];
      expect(loadMailConfig(env), `missing ${key}`).toBeNull();
    }
  });

  it("SMTP_PORT 可缺省，回退标准端口 587", () => {
    const env: Record<string, string> = { ...fullEnv };
    delete env.SMTP_PORT;
    expect(loadMailConfig(env)?.port).toBe(587);
  });

  it("端口非法返回 null", () => {
    expect(loadMailConfig({ ...fullEnv, SMTP_PORT: "not-a-port" })).toBeNull();
    expect(loadMailConfig({ ...fullEnv, SMTP_PORT: "99999" })).toBeNull();
  });

  it("isMailConfigured 与 loadMailConfig 一致", () => {
    expect(isMailConfigured(fullEnv)).toBe(true);
    expect(isMailConfigured({})).toBe(false);
  });
});

describe("renderInquiryMail（询盘邮件模板）", () => {
  const inquiry = { name: "张三", company: "某设计院", email: "zhang@example.com", phone: "13800000000", country: "中国", message: "需要 20 台洗墙灯的选型资料", productModel: "XW-100" };

  it("中文模板：主题含企业名与姓名，正文包含全部字段与需求描述", () => {
    const mail = renderInquiryMail({ tenantName: "硕名康", to: "notify@example.com", locale: "zh-CN", inquiry });
    expect(mail.subject).toContain("硕名康");
    expect(mail.subject).toContain("张三");
    expect(mail.text).toContain("某设计院");
    expect(mail.text).toContain("XW-100");
    expect(mail.text).toContain("需要 20 台洗墙灯");
  });

  it("英文模板：英文主题与字段", () => {
    const mail = renderInquiryMail({ tenantName: "Lumenworks", to: "notify@example.com", locale: "en", inquiry });
    expect(mail.subject).toContain("New inquiry");
    expect(mail.text).toContain("Name: 张三");
  });

  it("HTML 模板转义用户输入（防邮件内容注入）", () => {
    const mail = renderInquiryMail({ tenantName: "硕名康", to: "n@e.com", locale: "zh-CN", inquiry: { ...inquiry, name: "<script>alert(1)</script>", message: '包含 <img src=x> 标签' } });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&lt;img");
  });
});

describe("sendMail（transport 生命周期）", () => {
  it("发送后 close transport（防连接池泄漏），发送失败也 close", async () => {
    const mk = vi.mocked(nodemailer.createTransport);
    await sendMail({ host: "smtp.example.com", port: 465, secure: true, user: "u", pass: "p", from: "f@e.com" }, { to: "t@e.com", subject: "s", text: "t", html: "<p>h</p>" });
    expect(mk).toHaveBeenCalledOnce();
    const instance = mk.mock.results[0].value;
    expect(instance.close).toHaveBeenCalled();

    // 失败路径同样 close
    mk.mockClear();
    const failing = { sendMail: vi.fn().mockRejectedValue(new Error("smtp down")), close: vi.fn() };
    mk.mockReturnValueOnce(failing as never);
    await expect(sendMail({ host: "smtp.example.com", port: 465, secure: true, user: "u", pass: "p", from: "f@e.com" }, { to: "t@e.com", subject: "s", text: "t", html: "<p>h</p>" })).rejects.toThrow("smtp down");
    expect(failing.close).toHaveBeenCalled();
  });
});
