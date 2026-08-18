"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2).max(80), shortName: z.string().trim().max(30), description: z.string().trim().max(500),
  email: z.union([z.literal(""), z.email()]), phone: z.string().trim().max(40), address: z.string().trim().max(200),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  publicDownloads: z.boolean(),
});

export async function updateSettingsAction(formData: FormData) {
  const session = await requirePermission("tenant:manage");
  const parsed = schema.safeParse({ name: formData.get("name"), shortName: formData.get("shortName"), description: formData.get("description"), email: formData.get("email"), phone: formData.get("phone"), address: formData.get("address"), primaryColor: formData.get("primaryColor"), secondaryColor: formData.get("secondaryColor"), publicDownloads: formData.get("publicDownloads") === "on" });
  if (!parsed.success) redirect("/dashboard/settings?error=invalid");
  await getDb().$transaction([
    getDb().tenant.update({ where: { id: session.tenantId }, data: parsed.data }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "TENANT_SETTINGS_UPDATED", resource: "Tenant", resourceId: session.tenantId } }),
  ]);
  revalidatePath("/dashboard/settings"); redirect("/dashboard/settings?saved=1");
}
