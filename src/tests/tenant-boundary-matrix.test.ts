import { beforeEach, describe, expect, it, vi } from "vitest";

// 租户边界矩阵测试（审计报告点名优先项）：
// 对全部 13 处 TENANT_BOUNDARY_VIOLATION 抛点逐一验证——当资源不属于当前 session 租户时，
// action 必须抛边界违规，且其查询条件必须注入了 session 的 tenantId（防止「漏写租户条件」的回归）。
// 采用 mock DB 策略：所有 findFirst 记录调用参数并默认返回 null（即「该租户下查不到」），
// 不触碰真实数据库；写入路径（$transaction/update/create）在此测试中不应被走到。

const h = vi.hoisted(() => ({
  calls: [] as { model: string; args: { where?: Record<string, unknown> } }[],
  overrides: {} as Record<string, (args: { where?: Record<string, unknown> }) => unknown>,
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mk = (model: string) =>
    vi.fn((args: { where?: Record<string, unknown> }) => {
      h.calls.push({ model, args });
      const impl = h.overrides[model];
      return Promise.resolve(impl ? impl(args) : null);
    });
  return {
    getDb: () => ({
      product: { findFirst: mk("product"), update: vi.fn(), create: vi.fn() },
      productCategory: { findFirst: mk("productCategory") },
      productTranslation: { findFirst: mk("productTranslation") },
      productVariant: { findFirst: mk("productVariant") },
      newsPost: { findFirst: mk("newsPost") },
      newsPostTranslation: { findFirst: mk("newsPostTranslation") },
      projectCase: { findFirst: mk("projectCase") },
      projectCaseTranslation: { findFirst: mk("projectCaseTranslation") },
      inquiry: { findFirst: mk("inquiry") },
      domain: { findFirst: mk("domain") },
      tenant: { findFirst: mk("tenant"), findUnique: mk("tenant"), findUniqueOrThrow: vi.fn().mockResolvedValue({ navigationConfig: null }) },
      auditLog: { create: vi.fn() },
      $transaction: h.$transaction,
    }),
  };
});

vi.mock("@/lib/auth/dal", () => ({
  requirePermission: vi.fn().mockResolvedValue({ tenantId: "tenant-a", userId: "user-a", tenant: { name: "Tenant A" } }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createProductAction, setProductLocaleStatusAction, setProductStatusAction, updateProductAction } from "@/app/dashboard/products/actions";
import { deleteNewsAction, setNewsStatusAction, updateNewsAction } from "@/app/dashboard/news/actions";
import { deleteProjectAction, setProjectStatusAction, updateProjectAction } from "@/app/dashboard/projects/actions";
import { saveVariantParametersAction } from "@/app/dashboard/products/[id]/parameters/actions";
import { setInquiryStatusAction } from "@/app/dashboard/inquiries/actions";
import { deleteNavItemAction, setPrimaryDomainAction } from "@/app/dashboard/settings/actions";

function whereOf(model: string) {
  const call = h.calls.find((c) => c.model === model);
  if (!call) throw new Error(`expected a ${model} query to have been issued`);
  return call.args.where ?? {};
}

function expectBoundaryViolation(promise: Promise<unknown>) {
  return expect(promise).rejects.toThrow("TENANT_BOUNDARY_VIOLATION");
}

function productForm() {
  const fd = new FormData();
  fd.set("categoryId", "cat-1");
  fd.set("model", "XW-100");
  fd.set("slug", "xw-100");
  fd.set("nameZh", "洗墙灯");
  fd.set("nameEn", "Wall Washer");
  fd.set("skus", "XW-100A");
  return fd;
}
function newsForm() {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ slug: "post-1", category: "公司动态", titleZh: "标题", titleEn: "Title", excerptZh: "摘要", excerptEn: "Excerpt", bodyZh: "正文内容", bodyEn: "Body content" })) fd.set(k, v);
  return fd;
}
function projectForm() {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ slug: "case-1", category: "建筑立面", location: "上海", titleZh: "案例标题", titleEn: "Case title", summaryZh: "摘要", summaryEn: "Summary", descriptionZh: "描述内容", descriptionEn: "Description" })) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.calls.length = 0;
  h.overrides = {};
  h.$transaction.mockReset();
});

describe("租户边界矩阵：products", () => {
  it("createProductAction：分类属于其他租户（查不到）→ 抛边界违规，查询注入 session 租户", async () => {
    await expectBoundaryViolation(createProductAction(productForm()));
    expect(whereOf("productCategory")).toMatchObject({ tenantId: "tenant-a", id: "cat-1", isActive: true });
  });

  it("updateProductAction：产品 id 属于其他租户 → 抛边界违规，查询注入 tenantId", async () => {
    await expectBoundaryViolation(updateProductAction("prod-other", productForm()));
    expect(whereOf("product")).toMatchObject({ tenantId: "tenant-a", id: "prod-other" });
  });

  it("setProductStatusAction：产品 id 属于其他租户 → 抛边界违规", async () => {
    await expectBoundaryViolation(setProductStatusAction("prod-other", "publish"));
    expect(whereOf("product")).toMatchObject({ tenantId: "tenant-a", id: "prod-other" });
  });

  it("setProductLocaleStatusAction：翻译属于其他租户 → 抛边界违规，查询经 product.tenantId 约束", async () => {
    await expectBoundaryViolation(setProductLocaleStatusAction("prod-other", "ZH_CN", true));
    const w = whereOf("productTranslation");
    expect(w).toMatchObject({ productId: "prod-other", locale: "ZH_CN", product: { tenantId: "tenant-a" } });
  });
});

describe("租户边界矩阵：news", () => {
  it("updateNewsAction：文章属于其他租户 → 抛边界违规", async () => {
    await expectBoundaryViolation(updateNewsAction("post-other", newsForm()));
    expect(whereOf("newsPost")).toMatchObject({ tenantId: "tenant-a", id: "post-other", deletedAt: null });
  });

  it("setNewsStatusAction：文章属于其他租户 → 抛边界违规，查询经 tenantScope 注入", async () => {
    await expectBoundaryViolation(setNewsStatusAction("post-other", "ZH_CN", true));
    expect(whereOf("newsPost")).toMatchObject({ tenantId: "tenant-a", id: "post-other" });
  });

  it("deleteNewsAction：文章属于其他租户 → 抛边界违规", async () => {
    await expectBoundaryViolation(deleteNewsAction("post-other"));
    expect(whereOf("newsPost")).toMatchObject({ tenantId: "tenant-a", id: "post-other", deletedAt: null });
  });
});

describe("租户边界矩阵：projects", () => {
  it("updateProjectAction：案例属于其他租户 → 抛边界违规", async () => {
    await expectBoundaryViolation(updateProjectAction("case-other", projectForm()));
    expect(whereOf("projectCase")).toMatchObject({ tenantId: "tenant-a", id: "case-other" });
  });

  it("setProjectStatusAction：案例属于其他租户 → 抛边界违规", async () => {
    await expectBoundaryViolation(setProjectStatusAction("case-other", "ZH_CN", true));
    expect(whereOf("projectCase")).toMatchObject({ tenantId: "tenant-a", id: "case-other" });
  });

  it("deleteProjectAction：案例属于其他租户 → 抛边界违规", async () => {
    await expectBoundaryViolation(deleteProjectAction("case-other"));
    expect(whereOf("projectCase")).toMatchObject({ tenantId: "tenant-a", id: "case-other" });
  });
});

describe("租户边界矩阵：参数保存", () => {
  it("saveVariantParametersAction：产品属于其他租户 → 抛边界违规", async () => {
    const fd = new FormData();
    fd.set("param__v-1__d-1", "30");
    await expectBoundaryViolation(saveVariantParametersAction("prod-other", fd));
    expect(whereOf("product")).toMatchObject({ tenantId: "tenant-a", id: "prod-other" });
  });

  it("saveVariantParametersAction：formData 伪造非本产品变体 id → 抛边界违规（不信任表单字段）", async () => {
    h.overrides.product = () => ({ variants: [{ id: "v-real" }], category: { templates: [{ definitions: [{ id: "d-real" }] }] } });
    const fd = new FormData();
    fd.set("param__v-evil__d-real", "30"); // 变体不属于该产品，必须被拒绝
    await expectBoundaryViolation(saveVariantParametersAction("prod-1", fd));
  });
});

describe("租户边界矩阵：inquiries", () => {
  it("setInquiryStatusAction：询盘属于其他租户 → 抛边界违规", async () => {
    await expectBoundaryViolation(setInquiryStatusAction("inq-other", "VIEWED"));
    expect(whereOf("inquiry")).toMatchObject({ tenantId: "tenant-a", id: "inq-other" });
  });
});

describe("租户边界矩阵：settings（审计 #25 新增动作）", () => {
  it("setPrimaryDomainAction：域名属于其他租户或未验证 → 抛边界违规", async () => {
    await expectBoundaryViolation(setPrimaryDomainAction("domain-other"));
    expect(whereOf("domain")).toMatchObject({ tenantId: "tenant-a", id: "domain-other", isVerified: true });
  });

  it("deleteNavItemAction：导航项 id 不在本租户配置中 → 抛边界违规", async () => {
    await expectBoundaryViolation(deleteNavItemAction("evil-item"));
  });
});
