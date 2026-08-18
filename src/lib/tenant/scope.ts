/** Every tenant-owned query receives the tenant id from a verified session. */
export function tenantScope<T extends object = Record<string, never>>(tenantId: string, where?: T): T & { tenantId: string } {
  if (!tenantId) throw new Error("A verified tenant id is required");
  return { ...(where ?? ({} as T)), tenantId };
}
