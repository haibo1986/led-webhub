import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// globalThis 缓存：开发热重载时复用同一实例，避免连接池泄漏
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not configured");
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });
  }
  return globalForPrisma.prisma;
}
