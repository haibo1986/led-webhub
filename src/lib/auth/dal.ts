import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { can, type Permission } from "./permissions";
import { readSession } from "./session";
import { getDb } from "@/lib/db";

export const getValidatedSession = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const membership = await getDb().membership.findFirst({
    where: { userId: session.userId, tenantId: session.tenantId, user: { disabledAt: null }, tenant: { status: { in: ["TRIAL", "ACTIVE"] } } },
    select: { role: true, canPublish: true, user: { select: { id: true, name: true, email: true } }, tenant: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) return null;
  return { ...session, role: membership.role, canPublish: membership.canPublish, user: membership.user, tenant: membership.tenant };
});

export async function requireSession() {
  const session = await getValidatedSession();
  if (!session) redirect((await readSession()) ? "/login?error=session" : "/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  // 权限不足时回到工作台并提示，而不是抛错 500
  if (!can(session.role, permission, session.canPublish)) redirect("/dashboard?error=forbidden");
  return session;
}
