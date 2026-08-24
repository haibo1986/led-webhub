import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // generate/validate 不需要真实连接；CI 无 .env 时回退空串。
  // migrate 等需要连接的命令依赖本地 .env（dotenv/config 已加载）。
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
