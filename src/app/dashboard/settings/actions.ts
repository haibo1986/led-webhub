"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { homepageConfigSchema, navItemSchema, navigationConfigSchema, resolveNavigation, seoConfigSchema, type HomepageConfig, type SeoConfig } from "@/lib/site-config";

const schema = z.object({
  name: z.string().trim().min(2).max(80), shortName: z.string().trim().max(30), description: z.string().trim().max(500),
  email: z.union([z.literal(""), z.email()]), phone: z.string().trim().max(40), address: z.string().trim().max(200),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  publicDownloads: z.boolean(), aiEnabled: z.boolean(),
});

export async function updateSettingsAction(formData: FormData) {
  const session = await requirePermission("tenant:manage");
  const parsed = schema.safeParse({ name: formData.get("name"), shortName: formData.get("shortName"), description: formData.get("description"), email: formData.get("email"), phone: formData.get("phone"), address: formData.get("address"), primaryColor: formData.get("primaryColor"), secondaryColor: formData.get("secondaryColor"), publicDownloads: formData.get("publicDownloads") === "on", aiEnabled: formData.get("aiEnabled") === "on" });
  if (!parsed.success) redirect("/dashboard/settings?error=invalid");
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: session.tenantId }, data: parsed.data }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "TENANT_SETTINGS_UPDATED", resource: "Tenant", resourceId: session.tenantId, metadata: { aiEnabled: parsed.data.aiEnabled } } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect("/dashboard/settings?saved=1");
}

// ---------- 导航设置（Tenant.navigationConfig，审计 #25） ----------

type NavItem = z.infer<typeof navItemSchema>;

const navItemFields = navItemSchema.omit({ id: true });

async function loadNav(tenantId: string): Promise<NavItem[]> {
  const tenant = await getDb().tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { navigationConfig: true } });
  return resolveNavigation(tenant.navigationConfig);
}

function parseNavItemFields(formData: FormData) {
  return navItemFields.safeParse({
    type: formData.get("type"),
    page: formData.get("page") || undefined,
    labelZh: formData.get("labelZh"),
    labelEn: formData.get("labelEn"),
    href: formData.get("href") || undefined,
    enabled: formData.get("enabled") === "on",
  });
}

export async function addNavItemAction(formData: FormData) {
  const session = await requirePermission("tenant:manage");
  const parsed = parseNavItemFields(formData);
  if (!parsed.success) redirect("/dashboard/settings?error=nav");
  const nav = await loadNav(session.tenantId);
  if (nav.length >= 12) redirect("/dashboard/settings?error=nav");
  const item: NavItem = { id: randomUUID(), ...parsed.data };
  const next = navigationConfigSchema.safeParse([...nav, item]);
  if (!next.success) redirect("/dashboard/settings?error=nav");
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: session.tenantId }, data: { navigationConfig: next.data } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "TENANT_NAV_CREATED", resource: "Tenant", resourceId: session.tenantId, metadata: { navItemId: item.id } } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect("/dashboard/settings?saved=nav");
}

export async function updateNavItemAction(itemId: string, formData: FormData) {
  const session = await requirePermission("tenant:manage");
  const parsedId = z.string().trim().min(1).max(40).safeParse(itemId);
  const parsed = parseNavItemFields(formData);
  if (!parsedId.success || !parsed.success) redirect("/dashboard/settings?error=nav");
  const nav = await loadNav(session.tenantId);
  if (!nav.some((i) => i.id === parsedId.data)) throw new Error("TENANT_BOUNDARY_VIOLATION");
  const next = navigationConfigSchema.safeParse(nav.map((i) => (i.id === parsedId.data ? { ...parsed.data, id: i.id } : i)));
  if (!next.success) redirect("/dashboard/settings?error=nav");
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: session.tenantId }, data: { navigationConfig: next.data } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "TENANT_NAV_UPDATED", resource: "Tenant", resourceId: session.tenantId, metadata: { navItemId: parsedId.data } } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect("/dashboard/settings?saved=nav");
}

export async function moveNavItemAction(itemId: string, direction: "up" | "down") {
  const session = await requirePermission("tenant:manage");
  const parsedId = z.string().trim().min(1).max(40).safeParse(itemId);
  const parsedDir = z.enum(["up", "down"]).safeParse(direction);
  if (!parsedId.success || !parsedDir.success) redirect("/dashboard/settings?error=nav");
  const nav = await loadNav(session.tenantId);
  const index = nav.findIndex((i) => i.id === parsedId.data);
  const target = parsedDir.data === "up" ? index - 1 : index + 1;
  if (index === -1) throw new Error("TENANT_BOUNDARY_VIOLATION");
  if (target < 0 || target >= nav.length) redirect("/dashboard/settings?saved=nav");
  [nav[index], nav[target]] = [nav[target], nav[index]];
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: session.tenantId }, data: { navigationConfig: nav } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "TENANT_NAV_MOVED", resource: "Tenant", resourceId: session.tenantId, metadata: { navItemId: parsedId.data, direction: parsedDir.data } } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect("/dashboard/settings?saved=nav");
}

export async function deleteNavItemAction(itemId: string) {
  const session = await requirePermission("tenant:manage");
  const parsedId = z.string().trim().min(1).max(40).safeParse(itemId);
  if (!parsedId.success) redirect("/dashboard/settings?error=nav");
  const nav = await loadNav(session.tenantId);
  if (!nav.some((i) => i.id === parsedId.data)) throw new Error("TENANT_BOUNDARY_VIOLATION");
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: session.tenantId }, data: { navigationConfig: nav.filter((i) => i.id !== parsedId.data) } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "TENANT_NAV_DELETED", resource: "Tenant", resourceId: session.tenantId, metadata: { navItemId: parsedId.data } } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect("/dashboard/settings?saved=nav");
}

// ---------- 首页模块与 SEO 默认值（审计 #25） ----------

async function saveJsonConfig(config: { homepageConfig?: HomepageConfig; seoConfig?: SeoConfig }, action: string, savedKey: string) {
  const session = await requirePermission("tenant:manage");
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: session.tenantId }, data: config }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action, resource: "Tenant", resourceId: session.tenantId } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect(`/dashboard/settings?saved=${savedKey}`);
}

export async function updateHomepageConfigAction(formData: FormData) {
  const parsed = homepageConfigSchema.safeParse({
    hero: formData.get("hero") === "on",
    heroTitleZh: formData.get("heroTitleZh") || undefined,
    heroTitleEn: formData.get("heroTitleEn") || undefined,
    heroIntroZh: formData.get("heroIntroZh") || undefined,
    heroIntroEn: formData.get("heroIntroEn") || undefined,
    products: formData.get("products") === "on",
    capability: formData.get("capability") === "on",
  });
  if (!parsed.success) redirect("/dashboard/settings?error=home");
  await saveJsonConfig({ homepageConfig: parsed.data }, "TENANT_HOMEPAGE_UPDATED", "home");
}

export async function updateSeoConfigAction(formData: FormData) {
  const parsed = seoConfigSchema.safeParse({
    defaultTitle: formData.get("defaultTitle") || undefined,
    defaultDescriptionZh: formData.get("defaultDescriptionZh") || undefined,
    defaultDescriptionEn: formData.get("defaultDescriptionEn") || undefined,
    keywordsZh: formData.get("keywordsZh") || undefined,
    keywordsEn: formData.get("keywordsEn") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/settings?error=seo");
  await saveJsonConfig({ seoConfig: parsed.data }, "TENANT_SEO_UPDATED", "seo");
}

// ---------- 域名管理：租户侧主域名切换（开通/验证仍由平台后台负责） ----------

export async function setPrimaryDomainAction(domainId: string) {
  const session = await requirePermission("tenant:manage");
  const parsedId = z.string().trim().min(1).max(60).safeParse(domainId);
  if (!parsedId.success) redirect("/dashboard/settings?error=domain");
  // 只允许本租户的已验证域名设为主域名（未验证域名不可作为公开站主入口）
  const domain = await getDb().domain.findFirst({ where: { id: parsedId.data, tenantId: session.tenantId, isVerified: true } });
  if (!domain) throw new Error("TENANT_BOUNDARY_VIOLATION");
  await getDb().$transaction([
    getDb().domain.updateMany({ where: { tenantId: session.tenantId }, data: { isPrimary: false } }),
    getDb().domain.update({ where: { id: domain.id }, data: { isPrimary: true } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "TENANT_DOMAIN_PRIMARY", resource: "Domain", resourceId: domain.id, metadata: { hostname: domain.hostname } } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect("/dashboard/settings?saved=domain");
}
