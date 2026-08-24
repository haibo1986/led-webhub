"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";

export async function setInquiryStatusAction(id:string,status:"VIEWED"|"FOLLOWING"|"COMPLETED"|"INVALID"){const session=await requirePermission("inquiry:write");const parsedId=z.string().trim().max(60).safeParse(id);const parsedStatus=z.enum(["VIEWED","FOLLOWING","COMPLETED","INVALID"]).safeParse(status);if(!parsedId.success||!parsedStatus.success)throw new Error("INVALID_INPUT");const item=await getDb().inquiry.findFirst({where:{id:parsedId.data,tenantId:session.tenantId}});if(!item)throw new Error("TENANT_BOUNDARY_VIOLATION");await getDb().$transaction([getDb().inquiry.update({where:{id:parsedId.data},data:{status:parsedStatus.data}}),getDb().auditLog.create({data:{tenantId:session.tenantId,actorId:session.userId,action:`INQUIRY_${parsedStatus.data}`,resource:"Inquiry",resourceId:parsedId.data}})]);revalidatePath("/dashboard/inquiries")}

export async function addInquiryNoteAction(id: string, formData: FormData) {
  const session = await requirePermission("inquiry:write");
  const parsedId = z.string().trim().max(60).safeParse(id);
  const parsedContent = z.string().trim().min(1).max(2000).safeParse(String(formData.get("content") ?? ""));
  if (!parsedId.success || !parsedContent.success) throw new Error("INVALID_INPUT");
  const item = await getDb().inquiry.findFirst({ where: { id: parsedId.data, tenantId: session.tenantId } });
  if (!item) throw new Error("TENANT_BOUNDARY_VIOLATION");
  await getDb().$transaction([
    getDb().inquiryNote.create({ data: { tenantId: session.tenantId, inquiryId: parsedId.data, authorId: session.userId, content: parsedContent.data } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "INQUIRY_NOTE_CREATED", resource: "Inquiry", resourceId: parsedId.data } }),
  ]);
  revalidatePath("/dashboard/inquiries");
}
