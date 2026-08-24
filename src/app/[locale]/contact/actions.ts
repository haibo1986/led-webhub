"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getPublicTenant, type SiteLocale } from "@/lib/public-site";
import { loadMailConfig, renderInquiryMail, sendMail } from "@/lib/mail";

const schema = z.object({ name: z.string().trim().min(2).max(80), company: z.string().trim().max(120), email: z.email().max(160), phone: z.string().trim().max(50), country: z.string().trim().max(80), message: z.string().trim().min(10).max(2000), productId: z.string().trim().max(60).optional(), redirect: z.string().trim().max(300).optional(), website: z.string().max(0) });

export async function createInquiryAction(locale: SiteLocale, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(["name", "company", "email", "phone", "country", "message", "productId", "redirect", "website"].map(key => [key, String(formData.get(key) ?? "")])));
  if (!parsed.success) redirect(`/${locale}/contact?error=invalid`);
  // 公开表单限流：同一 IP+邮箱 1 小时内最多 3 次，防脚本灌库
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`inquiry:${ip}:${parsed.data.email}`, 3, 60 * 60 * 1000)) redirect(`/${locale}/contact?error=rate_limited`);
  const tenant = await getPublicTenant();
  // 产品关联：只接受属于当前租户且未删除的产品，防伪造 id 跨租户写入
  let productId: string | null = null;
  let productModel: string | null = null;
  if (parsed.data.productId) {
    const product = await getDb().product.findFirst({ where: { tenantId: tenant.id, id: parsed.data.productId, deletedAt: null }, select: { id: true, model: true } });
    if (product) { productId = product.id; productModel = product.model; }
  }
  // 回跳地址：仅允许站内相对路径，防开放重定向（含反斜杠归一化绕过）
  const requested = parsed.data.redirect ?? "";
  const candidate = requested.startsWith("/") && !requested.startsWith("//") ? new URL(requested, "http://local") : null;
  const back = candidate && !candidate.pathname.startsWith("//") ? candidate : new URL(`/${locale}/contact`, "http://local");
  back.searchParams.set("sent", "1");
  const inquiry = await getDb().inquiry.create({ data: { tenantId: tenant.id, productId, name: parsed.data.name, company: parsed.data.company || null, email: parsed.data.email, phone: parsed.data.phone || null, country: parsed.data.country || null, message: parsed.data.message, sourceUrl: back.pathname } });
  // 邮件通知（审计 #7）：询盘落库优先；SMTP 未配置/无收件邮箱记 SKIPPED，发送失败记 FAILED，均不影响询盘创建
  const config = loadMailConfig();
  const to = tenant.email?.trim();
  if (config && to) {
    const mail = renderInquiryMail({ tenantName: tenant.name, to, locale, inquiry: { name: parsed.data.name, company: parsed.data.company || null, email: parsed.data.email, phone: parsed.data.phone || null, country: parsed.data.country || null, message: parsed.data.message, productModel } });
    try {
      await sendMail(config, { ...mail, to });
      await getDb().emailLog.create({ data: { tenantId: tenant.id, inquiryId: inquiry.id, to, subject: mail.subject, status: "SENT" } });
    } catch (error) {
      await getDb().emailLog.create({ data: { tenantId: tenant.id, inquiryId: inquiry.id, to, subject: mail.subject, status: "FAILED", error: String(error instanceof Error ? error.message : error).slice(0, 500) } });
    }
  } else {
    await getDb().emailLog.create({ data: { tenantId: tenant.id, inquiryId: inquiry.id, to: to ?? "", subject: "", status: "SKIPPED" } });
  }
  redirect(`${back.pathname}${back.search}`);
}
