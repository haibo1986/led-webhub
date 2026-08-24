import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    locale: "zh-CN",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    // 本地默认 dev server（reuseExistingServer 复用已启动的实例）；
    // CI 里设 PLAYWRIGHT_WEBSERVER="npm run start" 跑生产构建
    command: process.env.PLAYWRIGHT_WEBSERVER ?? "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
