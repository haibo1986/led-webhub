import { expect, test } from "@playwright/test";

// 公开站关键流程（README 规划：Playwright 关键流程测试）：
// 首页 → 产品中心（参数筛选）→ 产品详情（规格矩阵/应用案例）→ 提交产品询盘
test.describe("公开站核心流程", () => {
  test("首页 → 产品中心 → 参数筛选 → 详情 → 询盘", async ({ page }) => {
    await page.goto("/zh-CN");
    await expect(page.locator("h1")).toContainText("光");

    // 产品中心：分类导航 + 筛选面板
    await page.goto("/zh-CN/products");
    await expect(page.locator(".catalog-filters")).toBeVisible();
    await expect(page.locator(".param-filters")).toBeVisible();

    // 参数筛选：选中 power=18，URL 更新且选中值 chip 高亮（已选 chip 的 href 是「取消」，不含当前参数）
    await page.locator('.param-filter-row a[href*="f_power=18"]').first().click();
    await expect(page).toHaveURL(/f_power=18/);
    await expect(page.locator(".param-filter-row a.active")).toHaveCount(1);
    await expect(page.locator(".param-filter-row a.active")).toContainText("18");

    // 进入产品详情：规格矩阵与关联案例区块
    await page.locator(".catalog-grid a").first().click();
    await expect(page).toHaveURL(/\/products\/[a-z0-9-]+/);
    await expect(page.locator(".public-spec-matrix")).toBeVisible();
    await expect(page.locator(".product-cases")).toBeVisible();

    // 提交产品询盘（蜜罐留空；邮箱带时间戳避开限流）
    await page.locator('.inquiry-form input[name="name"]').fill("测试客户");
    await page.locator('.inquiry-form input[name="email"]').fill(`e2e-${Date.now()}@example.com`);
    await page.locator('.inquiry-form textarea[name="message"]').fill("需要详细规格书与选型建议。");
    await page.locator(".inquiry-form button").click();
    await expect(page).toHaveURL(/sent=1/);
    await expect(page.locator(".inquiry-success")).toBeVisible();
  });
});
