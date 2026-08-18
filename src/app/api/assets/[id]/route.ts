import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getValidatedSession } from "@/lib/auth/dal";
import { resolveLocalObjectPath } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const asset = await getDb().asset.findFirst({ where: { id, deletedAt: null }, select: { id: true, tenantId: true, objectKey: true, fileName: true, mimeType: true, visibility: true, tenant: { select: { status: true, publicDownloads: true } }, products: { select: { product: { select: { status: true, deletedAt: true } } } } } });
  if (!asset) return new NextResponse("Not found", { status: 404 });
  if (asset.visibility === "PUBLIC" && (!asset.tenant.publicDownloads || !["TRIAL", "ACTIVE"].includes(asset.tenant.status) || !asset.products.some(({ product }) => product.status === "PUBLISHED" && product.deletedAt === null))) return new NextResponse("Not found", { status: 404 });
  if (asset.visibility !== "PUBLIC") { const session = await getValidatedSession(); if (!session) return new NextResponse("Unauthorized", { status: 401 }); if (session.tenantId !== asset.tenantId) return new NextResponse("Forbidden", { status: 403 }); }
  try { const filePath = resolveLocalObjectPath(asset.objectKey); await stat(filePath); const stream = createReadStream(filePath); return new NextResponse(Readable.toWeb(stream) as ReadableStream, { headers: { "Content-Type": asset.mimeType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`, "Cache-Control": asset.visibility === "PUBLIC" ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff" } }); } catch { return new NextResponse("File unavailable", { status: 404 }); }
}
