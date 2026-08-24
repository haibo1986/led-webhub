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

// ---------- 平台 M2：域名开通与验证 ----------

const hostnameSchema = z.string().trim().min(3).max(190).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "域名格式不正确");

export async function addDomainAction(formData: FormData) {
  const session = await requirePermission("platform:manage");
  const parsedTenant = z.string().trim().min(1).max(60).safeParse(String(formData.get("tenantId") ?? ""));
  const parsedHost = hostnameSchema.safeParse(String(formData.get("hostname") ?? "").toLowerCase());
  if (!parsedTenant.success || !parsedHost.success) redirect("/dashboard/platform?error=domain");
  const tenant = await getDb().tenant.findUnique({ where: { id: parsedTenant.data }, select: { id: true } });
  if (!tenant) throw new Error("NOT_FOUND");
  const duplicate = await getDb().domain.findUnique({ where: { hostname: parsedHost.data }, select: { id: true } });
  if (duplicate) redirect("/dashboard/platform?error=domain_duplicate");
  const isVerified = formData.get("verified") === "on";
  const domain = await getDb().domain.create({ data: { tenantId: tenant.id, hostname: parsedHost.data, isVerified, isPrimary: false } });
  await getDb().auditLog.create({ data: { tenantId: tenant.id, actorId: session.userId, action: "DOMAIN_ADDED", resource: "Domain", resourceId: domain.id, metadata: { hostname: parsedHost.data, isVerified } } });
  revalidatePath("/dashboard/platform"); redirect("/dashboard/platform?saved=domain");
}

export async function setDomainVerifiedAction(domainId: string, verified: boolean) {
  const session = await requirePermission("platform:manage");
  const parsedId = z.string().trim().min(1).max(60).safeParse(domainId);
  if (!parsedId.success || typeof verified !== "boolean") throw new Error("INVALID_INPUT");
  const domain = await getDb().domain.findUnique({ where: { id: parsedId.data }, select: { id: true, tenantId: true, hostname: true } });
  if (!domain) throw new Error("NOT_FOUND");
  // 取消验证时同时撤销主域名身份（未验证域名不得作为公开站主入口）
  await getDb().$transaction([
    getDb().domain.update({ where: { id: domain.id }, data: { isVerified: verified, ...(verified ? {} : { isPrimary: false }) } }),
    getDb().auditLog.create({ data: { tenantId: domain.tenantId, actorId: session.userId, action: verified ? "DOMAIN_VERIFIED" : "DOMAIN_UNVERIFIED", resource: "Domain", resourceId: domain.id, metadata: { hostname: domain.hostname } } }),
  ]);
  revalidatePath("/dashboard/platform");
}

export async function deleteDomainAction(domainId: string) {
  const session = await requirePermission("platform:manage");
  const parsedId = z.string().trim().min(1).max(60).safeParse(domainId);
  if (!parsedId.success) throw new Error("INVALID_INPUT");
  const domain = await getDb().domain.findUnique({ where: { id: parsedId.data }, select: { id: true, tenantId: true, hostname: true, isPrimary: true } });
  if (!domain) throw new Error("NOT_FOUND");
  // wasPrimary 记录删除时是否为主域名（主域名删除后公开站回退 DEFAULT_TENANT_SLUG，审计留痕可回溯）
  await getDb().$transaction([
    getDb().domain.delete({ where: { id: domain.id } }),
    getDb().auditLog.create({ data: { tenantId: domain.tenantId, actorId: session.userId, action: "DOMAIN_DELETED", resource: "Domain", resourceId: domain.id, metadata: { hostname: domain.hostname, wasPrimary: domain.isPrimary } } }),
  ]);
  revalidatePath("/dashboard/platform");
}
