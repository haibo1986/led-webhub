import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg(url) });

async function seedTenant(input: { slug: string; name: string; hostname: string; adminEmail: string; editorEmail: string; color: string; productPrefix: string; passwordHash: string }) {
  const tenant = await db.tenant.upsert({
    where: { slug: input.slug },
    update: {},
    create: { slug: input.slug, name: input.name, shortName: input.name.slice(0, 4), status: "ACTIVE", primaryColor: input.color, description: "专注建筑与景观照明的专业 LED 企业", email: `sales@${input.hostname}`, publicDownloads: true },
  });
  await db.domain.upsert({ where: { hostname: input.hostname }, update: { isPrimary: true, isVerified: true }, create: { tenantId: tenant.id, hostname: input.hostname, isPrimary: true, isVerified: true } });

  for (const [email, name, role, canPublish] of [[input.adminEmail, "企业管理员", "TENANT_ADMIN", true], [input.editorEmail, "内容编辑", "EDITOR", true]] as const) {
    const user = await db.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash: input.passwordHash } });
    await db.membership.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } }, update: { role, canPublish }, create: { tenantId: tenant.id, userId: user.id, role, canPublish } });
  }

  const category = await db.productCategory.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "wall-washer" } },
    update: {},
    create: { tenantId: tenant.id, slug: "wall-washer", nameZh: "洗墙灯", nameEn: "Wall Washer", sortOrder: 10 },
  });
  let template = await db.parameterTemplate.findFirst({ where: { tenantId: tenant.id, categoryId: category.id } });
  if (!template) template = await db.parameterTemplate.create({ data: { tenantId: tenant.id, categoryId: category.id, name: "洗墙灯标准参数", definitions: { create: [
    { key: "power", labelZh: "功率", labelEn: "Power", fieldType: "number", unit: "W", groupName: "电气", isRequired: true, isFilterable: true },
    { key: "beam_angle", labelZh: "光束角", labelEn: "Beam angle", fieldType: "text", unit: "°", groupName: "光学", isFilterable: true },
    { key: "ip_rating", labelZh: "防护等级", labelEn: "IP rating", fieldType: "select", groupName: "防护环境", isRequired: true, isFilterable: true },
  ] } } });

  const model = `${input.productPrefix}30`;
  const product = await db.product.upsert({
    where: { tenantId_model: { tenantId: tenant.id, model } },
    update: {},
    create: { tenantId: tenant.id, categoryId: category.id, model, slug: `${input.productPrefix.toLowerCase()}30-linear-wall-washer`, status: "PUBLISHED", featured: true, publishedAt: new Date(), translations: { create: [
      { locale: "ZH_CN", name: "窄体线性洗墙灯", tagline: "连续、均匀、精准的立面光", isPublished: true },
      { locale: "EN", name: "Slim Linear Wall Washer", tagline: "Continuous and precise facade illumination", isPublished: true },
    ] }, variants: { create: [
      { sku: `${model}-18W`, name: "18W / 500mm" }, { sku: `${model}-24W`, name: "24W / 1000mm" }, { sku: `${model}-36W`, name: "36W / 1200mm" },
    ] } },
  });
  await db.auditLog.create({ data: { tenantId: tenant.id, action: "SEED_CREATED", resource: "Product", resourceId: product.id } });

  for (const item of [
    { slug: "flood-light", nameZh: "投光灯", nameEn: "Flood Light", sortOrder: 20 },
    { slug: "linear-light", nameZh: "线性灯", nameEn: "Linear Light", sortOrder: 30 },
    { slug: "in-ground-light", nameZh: "地埋灯", nameEn: "In-ground Light", sortOrder: 40 },
  ]) await db.productCategory.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: item.slug } },
    update: { nameZh: item.nameZh, nameEn: item.nameEn, sortOrder: item.sortOrder },
    create: { tenantId: tenant.id, ...item },
  });

  const projectCase = await db.projectCase.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "cultural-center-facade" } },
    update: {},
    create: { tenantId: tenant.id, slug: "cultural-center-facade", category: "建筑照明", location: "中国 · 广东", status: "PUBLISHED", featured: true, publishedAt: new Date() },
  });
  for (const translation of [
    { locale: "ZH_CN" as const, title: "城市文化中心立面照明", summary: "以克制的线性光重塑建筑夜间秩序。", description: "通过多层次洗墙与节点重点照明，在控制眩光的同时呈现建筑材料与结构关系。" },
    { locale: "EN" as const, title: "Civic Cultural Center Facade", summary: "A restrained linear-light composition for the night-time facade.", description: "Layered wall washing and precise accents reveal the architecture while maintaining visual comfort." },
  ]) await db.projectCaseTranslation.upsert({ where: { caseId_locale: { caseId: projectCase.id, locale: translation.locale } }, update: { ...translation, isPublished: true }, create: { caseId: projectCase.id, ...translation, isPublished: true } });

  const newsPost = await db.newsPost.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "new-optical-platform-2026" } },
    update: {},
    create: { tenantId: tenant.id, slug: "new-optical-platform-2026", category: "企业资讯", status: "PUBLISHED", publishedAt: new Date() },
  });
  for (const translation of [
    { locale: "ZH_CN" as const, title: "新一代精密配光平台正式发布", excerpt: "覆盖建筑立面、景观与道路照明的模块化光学系统。", body: "新平台以统一光学接口连接多种灯具体系，为设计师提供更精确的光束选择，并降低工程选型与维护成本。" },
    { locale: "EN" as const, title: "Next-generation precision optics platform released", excerpt: "A modular optical system for facade, landscape and roadway lighting.", body: "The unified optical interface expands beam choices while simplifying specification and long-term maintenance." },
  ]) await db.newsPostTranslation.upsert({ where: { postId_locale: { postId: newsPost.id, locale: translation.locale } }, update: { ...translation, isPublished: true }, create: { postId: newsPost.id, ...translation, isPublished: true } });
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") throw new Error("Refusing to seed in production. Set ALLOW_SEED=true to override.");
  // 演示密码：优先取 DEMO_PASSWORD 环境变量；未设置则随机生成。仅在新账号 create 时写入，已有账号密码不会被重置。
  const demoPassword = process.env.DEMO_PASSWORD ?? randomBytes(12).toString("base64url");
  const passwordHash = await hash(demoPassword, 12);
  await seedTenant({ slug: "lumenworks", name: "流明光电", hostname: "lumenworks.localhost", adminEmail: "admin@lumenworks.cn", editorEmail: "editor@lumenworks.cn", color: "#d99829", productPrefix: "XW", passwordHash });
  await seedTenant({ slug: "aurora", name: "极光照明", hostname: "aurora.localhost", adminEmail: "admin@aurora.cn", editorEmail: "editor@aurora.cn", color: "#4f7b83", productPrefix: "AW", passwordHash });
  console.log(`Seeded two isolated tenants. Demo accounts password: ${demoPassword}`);
}

main().finally(() => db.$disconnect());
