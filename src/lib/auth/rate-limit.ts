import "server-only";

// 内存版限流：单实例部署够用；多实例生产环境应替换为 Redis 等共享存储。
const attempts = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > windowMs) { attempts.set(key, { count: 1, windowStart: now }); return true; }
  entry.count += 1;
  return entry.count <= max;
}

export function clearRateLimit(key: string) { attempts.delete(key); }

// 登录：5 次失败 / 15 分钟锁定
export const checkLoginRateLimit = (key: string) => checkRateLimit(key, 5, 15 * 60 * 1000);
export const clearLoginRateLimit = clearRateLimit;
