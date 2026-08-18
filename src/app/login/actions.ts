"use server";

import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/auth/rate-limit";

const loginSchema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(8).max(128) });

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=invalid");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateKey = `login:${ip}:${parsed.data.email}`;
  if (!checkLoginRateLimit(rateKey)) redirect("/login?error=rate_limited");
  const user = await getDb().user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: { where: { tenant: { status: { in: ["TRIAL", "ACTIVE"] } } }, orderBy: { role: "asc" }, take: 1 } },
  });
  if (!user || user.disabledAt || !user.memberships[0] || !(await compare(parsed.data.password, user.passwordHash))) redirect("/login?error=credentials");
  const membership = user.memberships[0];
  await createSession({ userId: user.id, tenantId: membership.tenantId, role: membership.role, canPublish: membership.canPublish });
  clearLoginRateLimit(rateKey);
  await getDb().auditLog.create({ data: { tenantId: membership.tenantId, actorId: user.id, action: "AUTH_LOGIN", resource: "Session" } });
  redirect("/dashboard");
}

export async function logoutAction() { await destroySession(); redirect("/login"); }
