import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { putLocalObject, safeObjectKey } from "@/lib/storage";

const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".ies", ".ldt", ".dwg", ".dxf", ".step"]);
// 不信任客户端声明的 mimeType，按扩展名映射白名单
const mimeByExt: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf", ".ies": "application/octet-stream", ".ldt": "application/octet-stream", ".dwg": "application/acad", ".dxf": "application/dxf", ".step": "application/step" };
const maxBytes = 25 * 1024 * 1024;

// 魔数校验：图片与 PDF 按文件头验证真实类型，防止改名伪装（IES/LDT/DWG 等文本/二进制格式无可靠魔数，跳过）
function magicMatches(extension: string, head: Uint8Array) {
  if (extension === ".jpg" || extension === ".jpeg") return head[0] === 0xff && head[1] === 0xd8;
  if (extension === ".png") return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (extension === ".pdf") return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  if (extension === ".webp") return head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  return true;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("content:write"); const { id: productId } = await params;
  // 上传请求来源校验（浏览器 POST 必带 Origin；非浏览器客户端缺失时放行，由会话鉴权兜底）
  const origin = request.headers.get("origin");
  if (origin) {
    const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
    if (requestHost && new URL(origin).host !== requestHost) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const product = await getDb().product.findFirst({ where: { id: productId, tenantId: session.tenantId, deletedAt: null }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const form = await request.formData(); const file = form.get("file"); const visibility = String(form.get("visibility") ?? "INTERNAL"); const role = String(form.get("role") ?? "DOCUMENT").slice(0, 30);
  if (!(file instanceof File) || file.size === 0 || file.size > maxBytes) return NextResponse.redirect(new URL(`/dashboard/products/${productId}?upload=invalid`, request.url), 303);
  const extension = path.extname(file.name).toLowerCase(); if (!allowed.has(extension)) return NextResponse.redirect(new URL(`/dashboard/products/${productId}?upload=type`, request.url), 303);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!magicMatches(extension, bytes.slice(0, 12))) return NextResponse.redirect(new URL(`/dashboard/products/${productId}?upload=type`, request.url), 303);
  // 清洗文件名：剥离 CR/LF 等控制字符，防止响应头注入
  const fileName = file.name.slice(0, 180).replace(/[\r\n\x00-\x1f]/g, "");
  const assetId = randomUUID(); const objectKey = safeObjectKey(session.tenantId, assetId, extension); await putLocalObject(objectKey, bytes);
  const asset = await getDb().asset.create({ data: { tenantId: session.tenantId, uploadedById: session.userId, objectKey, fileName, mimeType: mimeByExt[extension], sizeBytes: BigInt(file.size), visibility: visibility === "PUBLIC" || visibility === "CONTROLLED" ? visibility : "INTERNAL", products: { create: { productId, role } } } });
  await getDb().auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "ASSET_UPLOADED", resource: "Asset", resourceId: asset.id, metadata: { productId, size: file.size, visibility: asset.visibility } } });
  return NextResponse.redirect(new URL(`/dashboard/products/${productId}?upload=success`, request.url), 303);
}
