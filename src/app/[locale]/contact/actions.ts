"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getPublicTenant, type SiteLocale } from "@/lib/public-site";

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
  if (parsed.data.productId) {
    const product = await getDb().product.findFirst({ where: { tenantId: tenant.id, id: parsed.data.productId, deletedAt: null }, select: { id: true } });
    if (product) productId = product.id;
  }
  // 回跳地址：仅允许站内相对路径，防开放重定向（含反斜杠归一化绕过）
  const requested = parsed.data.redirect ?? "";
  const candidate = requested.startsWith("/") && !requested.startsWith("//") ? new URL(requested, "http://local") : null;
  const back = candidate && !candidate.pathname.startsWith("//") ? candidate : new URL(`/${locale}/contact`, "http://local");
  back.searchParams.set("sent", "1");
  await getDb().inquiry.create({ data: { tenantId: tenant.id, productId, name: parsed.data.name, company: parsed.data.company || null, email: parsed.data.email, phone: parsed.data.phone || null, country: parsed.data.country || null, message: parsed.data.message, sourceUrl: back.pathname } });
  redirect(`${back.pathname}${back.search}`);
}
