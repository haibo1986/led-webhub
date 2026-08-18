export const roles = ["PLATFORM_ADMIN", "TENANT_ADMIN", "EDITOR", "VIEWER"] as const;
export type MemberRole = (typeof roles)[number];
export type Permission = "platform:manage" | "tenant:manage" | "content:read" | "content:write" | "content:publish" | "inquiry:read" | "inquiry:write" | "audit:read";

const rolePermissions: Record<MemberRole, ReadonlySet<Permission>> = {
  PLATFORM_ADMIN: new Set(["platform:manage", "tenant:manage", "content:read", "content:write", "content:publish", "inquiry:read", "inquiry:write", "audit:read"]),
  TENANT_ADMIN: new Set(["tenant:manage", "content:read", "content:write", "content:publish", "inquiry:read", "inquiry:write", "audit:read"]),
  EDITOR: new Set(["content:read", "content:write", "content:publish", "inquiry:read", "inquiry:write"]),
  VIEWER: new Set(["content:read", "inquiry:read"]),
};

export function can(role: MemberRole, permission: Permission, canPublish = false) {
  if (permission === "content:publish" && role === "EDITOR") return canPublish;
  return rolePermissions[role].has(permission);
}
