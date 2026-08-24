import "dotenv/config";
import { hash } from "bcryptjs";
import { Client } from "pg";

// E2E 前置：把演示管理员账号密码重置为固定值，保证测试确定性。
// 用 pg 直连（生成的 Prisma client 是 CJS，与 Playwright 的 ESM 转译不兼容）。
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for e2e global setup");
  const password = process.env.E2E_PASSWORD ?? "WebHubDev2026";
  const passwordHash = await hash(password, 12);
  const client = new Client({ connectionString: url });
  await client.connect();
  const emails = ["admin@lumenworks.cn", "admin@aurora.cn", "platform@lumenworks.cn"];
  for (const email of emails) {
    await client.query('UPDATE "User" SET "passwordHash" = $1, "disabledAt" = NULL WHERE email = $2', [passwordHash, email]);
  }
  await client.end();
}
