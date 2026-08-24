import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { putLocalObject, safeObjectKey } from "@/lib/storage";

// 案例图片：仅图片格式；role 限 COVER（封面）/ IMAGE（画廊）；visibility 固定 PUBLIC（案例图即公开站展示用）
const allowed = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const mimeByExt: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const maxBytes = 25 * 1024 * 1024;

function magicMatches(extension: string, head: Uint8Array) {
  if (extension === ".jpg" || extension === ".jpeg") return head[0] === 0xff && head[1] === 0xd8;
  if (extension === ".png") return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (extension === ".webp") return head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  return true;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("content:write"); const { id: caseId } = await params;
  const origin = request.headers.get("origin");
  if (origin) {
    const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
    if (requestHost && new URL(origin).host !== requestHost) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const item = await getDb().projectCase.findFirst({ where: { id: caseId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  const form = await request.formData(); const file = form.get("file"); const role = String(form.get("role") ?? "IMAGE") === "COVER" ? "COVER" : "IMAGE";
  if (!(file instanceof File) || file.size === 0 || file.size > maxBytes) return NextResponse.redirect(new URL(`/dashboard/projects/${caseId}?upload=invalid`, request.url), 303);
  const extension = path.extname(file.name).toLowerCase(); if (!allowed.has(extension)) return NextResponse.redirect(new URL(`/dashboard/projects/${caseId}?upload=type`, request.url), 303);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!magicMatches(extension, bytes.slice(0, 12))) return NextResponse.redirect(new URL(`/dashboard/projects/${caseId}?upload=type`, request.url), 303);
  // 清洗文件名：剥离 CR/LF 等控制字符，防止响应头注入
  const fileName = file.name.slice(0, 180).replace(/[\r\n\x00-\x1f]/g, "");
  const assetId = randomUUID(); const objectKey = safeObjectKey(session.tenantId, assetId, extension); await putLocalObject(objectKey, bytes);
  const asset = await getDb().asset.create({ data: { tenantId: session.tenantId, uploadedById: session.userId, objectKey, fileName, mimeType: mimeByExt[extension], sizeBytes: BigInt(file.size), visibility: "PUBLIC", cases: { create: { caseId, role } } } });
  await getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "ASSET_UPLOADED", resource: "Asset", resourceId: asset.id, metadata: { caseId, size: file.size, role } } });
  return NextResponse.redirect(new URL(`/dashboard/projects/${caseId}?upload=success`, request.url), 303);
}

// 设为封面 / 移除（解除关联 + 资产软删）
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("content:write"); const { id: caseId } = await params;
  const item = await getDb().projectCase.findFirst({ where: { id: caseId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  const link = await getDb().projectCaseAsset.findUnique({ where: { caseId_assetId: { caseId, assetId } }, select: { role: true } });
  if (!link) return NextResponse.json({ error: "Not linked" }, { status: 404 });
  await getDb().$transaction([
    getDb().projectCaseAsset.delete({ where: { caseId_assetId: { caseId, assetId } } }),
    getDb().asset.update({ where: { id: assetId }, data: { deletedAt: new Date() } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "ASSET_REMOVED", resource: "Asset", resourceId: assetId, metadata: { caseId, role: link.role } } }),
  ]);
  return NextResponse.json({ ok: true });
}

// 设为封面：原 COVER 降为 IMAGE，目标升为 COVER
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("content:write"); const { id: caseId } = await params;
  const item = await getDb().projectCase.findFirst({ where: { id: caseId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  const link = await getDb().projectCaseAsset.findUnique({ where: { caseId_assetId: { caseId, assetId } } });
  if (!link) return NextResponse.json({ error: "Not linked" }, { status: 404 });
  await getDb().$transaction([
    getDb().projectCaseAsset.updateMany({ where: { caseId, role: "COVER" }, data: { role: "IMAGE" } }),
    getDb().projectCaseAsset.update({ where: { caseId_assetId: { caseId, assetId } }, data: { role: "COVER" } }),
    getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "ASSET_ROLE_CHANGED", resource: "Asset", resourceId: assetId, metadata: { caseId, role: "COVER" } } }),
  ]);
  return NextResponse.json({ ok: true });
}
