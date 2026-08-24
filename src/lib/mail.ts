import nodemailer from "nodemailer";

// 询盘邮件通知（审计 #7）：
// SMTP 凭据全部来自环境变量，未配置时 isMailConfigured 为 false，
// 调用方（contact/actions）记 SKIPPED 日志并跳过发送，开发/无邮件环境零阻塞。
// 生产部署前在 .env 配置 SMTP_HOST/PORT/USER/PASS/FROM（见 .env.example）。

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export function loadMailConfig(env: Record<string, string | undefined> = process.env): MailConfig | null {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT ?? "587");
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM?.trim();
  if (!host || !user || !pass || !from) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port, secure: env.SMTP_SECURE === "true", user, pass, from };
}

export function isMailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return loadMailConfig(env) !== null;
}

export type InquiryMailInput = {
  tenantName: string;
  to: string;
  locale: "zh-CN" | "en";
  inquiry: { name: string; company: string | null; email: string; phone: string | null; country: string | null; message: string; productModel: string | null };
};

export function renderInquiryMail(input: InquiryMailInput): { subject: string; text: string; html: string } {
  const zh = input.locale === "zh-CN";
  const subject = zh ? `【${input.tenantName}官网】新询盘：${input.inquiry.name}` : `[${input.tenantName} Website] New inquiry from ${input.inquiry.name}`;
  const lines = zh
    ? [`${input.tenantName} 官网收到一条新询盘，请登录管理后台查看处理：`, "", `姓名：${input.inquiry.name}`, `公司：${input.inquiry.company ?? "—"}`, `邮箱：${input.inquiry.email}`, `电话：${input.inquiry.phone ?? "—"}`, `国家/地区：${input.inquiry.country ?? "—"}`, `关联产品：${input.inquiry.productModel ?? "—"}`, "", "需求描述：", input.inquiry.message]
    : [`A new inquiry was submitted on the ${input.tenantName} website. Sign in to the admin dashboard to follow up:`, "", `Name: ${input.inquiry.name}`, `Company: ${input.inquiry.company ?? "—"}`, `Email: ${input.inquiry.email}`, `Phone: ${input.inquiry.phone ?? "—"}`, `Country: ${input.inquiry.country ?? "—"}`, `Product: ${input.inquiry.productModel ?? "—"}`, "", "Message:", input.inquiry.message];
  const text = lines.join("\n");
  const html = `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222">${lines.map((line, i) => (i === lines.length - 1 ? `<p style="margin:12px 0 0;white-space:pre-wrap;background:#f6f4ee;padding:14px;border-radius:6px">${escapeHtml(line)}</p>` : `<p style="margin:4px 0">${escapeHtml(line)}</p>`)).join("")}<p style="margin-top:18px;font-size:12px;color:#888">${zh ? "本邮件由系统自动发送，请勿直接回复。" : "This is an automated message. Please do not reply."}</p></div>`;
  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendMail(config: MailConfig, mail: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.pass } });
  await transport.sendMail({ from: config.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
}
