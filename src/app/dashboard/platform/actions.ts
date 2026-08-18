"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hash } from "bcryptjs";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";

const createTenantSchema = z.object({ slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().trim().min(2).max(60), hostname: z.string().trim().min(3).max(190), adminEmail: z.email().max(160), adminPassword: z.string().min(8).max(128) });

export async function createTenantAction(formData: FormData) {
  const session = await requirePermission("platform:manage");
  const parsed = createTenantSchema.safeParse(Object.fromEntries(["slug", "name", "hostname", "adminEmail", "adminPassword"].map(key => [key, String(formData.get(key) ?? "")])));
  if (!parsed.success) redirect("/dashboard/platform?error=invalid");
  const { slug, name, hostname, adminEmail, adminPassword } = parsed.data;
  const duplicate = await getDb().tenant.findFirst({ where: { OR: [{ slug }, { domains: { some: { hostname } } }] }, select: { id: true } });
  if (duplicate) redirect("/dashboard/platform?error=duplicate");
  const passwordHash = await hash(adminPassword, 12);
  const tenant = await getDb().tenant.create({ data: { slug, name, shortName: name.slice(0, 4), status: "TRIAL", domains: { create: { hostname, isPrimary: true, isVerified: true } } } });
  const user = await getDb().user.upsert({ where: { email: adminEmail }, update: {}, create: { email: adminEmail, name: "企业管理员", passwordHash } });
  // 已有账号复用：不覆盖其现有密码，仅建立新租户的成员关系
  await getDb().membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "TENANT_ADMIN", canPublish: true } });
  await getDb().auditLog.create({ data: { tenantId: tenant.id, actorId: session.userId, action: "TENANT_CREATED", resource: "Tenant", resourceId: tenant.id, metadata: { hostname, adminEmail } } });
  revalidatePath("/dashboard/platform");
  redirect("/dashboard/platform?created=1");
}

export async function setTenantStatusAction(tenantId: string, status: "ACTIVE" | "SUSPENDED") {
  const session = await requirePermission("platform:manage");
  const parsed = z.string().trim().max(60).safeParse(tenantId);
  if (!parsed.success) throw new Error("INVALID_TENANT_ID");
  const tenant = await getDb().tenant.findUnique({ where: { id: parsed.data }, select: { id: true } });
  if (!tenant) throw new Error("NOT_FOUND");
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: tenant.id }, data: { status } }),
    getDb().auditLog.create({ data: { tenantId: tenant.id, actorId: session.userId, action: `TENANT_${status}`, resource: "Tenant", resourceId: tenant.id } }),
  ]);
  revalidatePath("/dashboard/platform");
}
