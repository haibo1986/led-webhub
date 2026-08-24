import { expect, test } from "@playwright/test";
import { Client } from "pg";

// 租户越权 E2E（README 规划）：A 租户登录后无法访问 B 租户资源。
// 测试进程直连 DB 取 B 租户产品 id（仅读取，不做任何写入）。
const client = new Client({ connectionString: process.env.DATABASE_URL ?? "" });

async function productIdOf(tenantSlug: string): Promise<string | null> {
  const r = await client.query('SELECT p.id FROM "Product" p JOIN "Tenant" t ON t.id = p."tenantId" WHERE t.slug = $1 AND p."deletedAt" IS NULL LIMIT 1', [tenantSlug]);
  return r.rows[0]?.id ?? null;
}

test.beforeAll(async () => {
  await client.connect();
});

test.afterAll(async () => {
  await client.end();
});

test.describe("租户隔离", () => {
  test("A 租户会话访问 B 租户产品编辑页被拒（404），本租户产品正常", async ({ page }) => {
    const foreign = await productIdOf("aurora");
    const own = await productIdOf("lumenworks");
    expect(foreign).toBeTruthy();
    expect(own).toBeTruthy();

    // 登录 A 租户（lumenworks 管理员）
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@lumenworks.cn");
    await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD ?? "WebHubDev2026");
    await page.locator(".auth-form button").click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 本租户产品编辑页可访问
    await page.goto(`/dashboard/products/${own}`);
    await expect(page.locator(".product-editor-nav")).toBeVisible();

    // 跨租户产品 id → 页面按「不存在」处理（租户条件过滤后查不到）
    await page.goto(`/dashboard/products/${foreign}`);
    await expect(page.getByText("页面不存在或已下架。").or(page.getByText("This page could not be found."))).toBeVisible();
  });

  test("未登录访问后台重定向到登录页", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
