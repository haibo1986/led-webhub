import { expect, test } from "@playwright/test";

// 案例上传便捷性验收（sweety 需求）：只填项目名称即可创建，slug 自动生成，图片与发布流程可用
test.describe("案例创建流程", () => {
  test("只填项目名称 → 自动拼音 slug → 编辑页双语提示条", async ({ page }) => {
    const title = `验收案例${Date.now().toString(36)}`;

    // 登录
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@lumenworks.cn");
    await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD ?? "WebHubDev2026");
    await page.locator(".auth-form button").click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 新建案例：只填项目名称
    await page.goto("/dashboard/projects/new");
    await page.locator('input[name="titleZh"]').fill(title);
    await page.locator('button[type="submit"], form .sticky-save button').click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/.+\?created=1/);

    // 编辑页：slug 已自动生成（高级选项里）、双语提示条显示「中文：未发布 / 英文：未填写」
    await page.locator(".advanced-options summary").click();
    const slugValue = await page.locator('.advanced-options input[name="slug"]').inputValue();
    expect(slugValue.length).toBeGreaterThan(4); // 拼音自动生成非空
    await expect(page.locator(".locale-banner")).toContainText("English：未填写");

    // 补充英文标题后保存 → 中文发布 → 公开站可见
    await page.locator('input[name="titleEn"]').fill(`Acceptance case ${Date.now().toString(36)}`);
    await page.locator('textarea[name="descriptionZh"]').fill("用于验收案例创建与发布流程的自动化测试案例。");
    await page.locator('button[type="submit"], form .sticky-save button').first().click();
    await expect(page).toHaveURL(/saved=1/);
    const caseUrl = page.url().replace(/\?.*$/, "");
    await page.goto(caseUrl);
    await page.locator(".locale-publish-actions form button").first().click(); // 发布中文
    await expect(page.locator(".locale-publish-actions .is-live")).toHaveCount(1);

    // 公开站列表可见（featured 排序下新案例未必在首位，按标题全文查找）
    await page.goto("/zh-CN/projects");
    await expect(page.locator(".project-card", { hasText: title })).toHaveCount(1);
  });
});
