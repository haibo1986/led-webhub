import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import yauzl from "yauzl";
import { getValidatedSession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { putLocalObject, safeObjectKey } from "@/lib/storage";
import { isAllowedImageExt, matchImageFileName, type ImageFileMatch } from "@/lib/import/image-filenames";

const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const mimeByExt: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".dwg": "application/acad", ".dxf": "application/dxf", ".step": "application/step" };

// POST multipart（file=zip）→ 解压 → 按文件名约定匹配本租户产品 → 落库（Asset + ProductAsset 分区角色）+ 审计。
// 匹配不上的文件与不支持的类型列入 unmatched 返回，不静默丢弃。
export async function POST(request: Request) {
  const session = await getValidatedSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!can(session.role, "content:write", session.canPublish)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_ZIP_BYTES) return NextResponse.json({ error: "压缩包需在 100MB 以内" }, { status: 400 });

  // 本租户产品型号集合（含软删过滤）
  const products = await getDb().product.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, select: { id: true, model: true } });
  const modelToId = new Map(products.map((p) => [p.model.toLowerCase(), p.id]));
  const models = products.map((p) => p.model);

  // 解压并匹配
  const zipBuffer = Buffer.from(await file.arrayBuffer());
  const matches: (ImageFileMatch & { buffer: Buffer })[] = [];
  const unmatched: string[] = [];
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("zip 解析失败"));
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) return zip.readEntry();
        const name = path.basename(entry.fileName);
        if (entry.uncompressedSize > MAX_FILE_BYTES) { unmatched.push(`${name}（超过 25MB）`); return zip.readEntry(); }
        const match = matchImageFileName(name, models);
        if (!match || !isAllowedImageExt(name)) { unmatched.push(name); return zip.readEntry(); }
        zip.openReadStream(entry, (openErr, stream) => {
          if (openErr || !stream) { unmatched.push(name); return zip.readEntry(); }
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("end", () => { matches.push({ ...match, buffer: Buffer.concat(chunks) }); zip.readEntry(); });
        });
      });
      zip.on("end", resolve);
      zip.on("error", reject);
    });
  });

  // 按型号分组落库（每组一个事务：Asset ×N + ProductAsset ×N + 审计 ×1）
  const byModel = new Map<string, (ImageFileMatch & { buffer: Buffer })[]>();
  for (const m of matches) {
    const list = byModel.get(m.model.toLowerCase()) ?? [];
    list.push(m);
    byModel.set(m.model.toLowerCase(), list);
  }
  const imported: { model: string; files: number }[] = [];
  for (const [modelKey, files] of byModel) {
    const productId = modelToId.get(modelKey);
    if (!productId) { for (const f of files) unmatched.push(f.fileName); continue; }
    const sorted = files.sort((a, b) => a.fileName.localeCompare(b.fileName, "zh-CN", { numeric: true }));
    const assets = await getDb().$transaction(async (tx) => {
      const created: string[] = [];
      for (const [i, f] of sorted.entries()) {
        const extension = path.extname(f.fileName).toLowerCase();
        const assetId = randomUUID();
        const objectKey = safeObjectKey(session.tenantId, assetId, extension);
        await putLocalObject(objectKey, f.buffer);
        await tx.asset.create({ data: { tenantId: session.tenantId, uploadedById: session.userId, objectKey, fileName: f.fileName.slice(0, 180).replace(/[\r\n\x00-\x1f]/g, ""), mimeType: mimeByExt[extension] ?? "application/octet-stream", sizeBytes: BigInt(f.buffer.length), visibility: "PUBLIC", products: { create: { productId, role: f.role, sortOrder: i } } } });
        created.push(assetId);
      }
      await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: "PRODUCTS_IMAGES_IMPORTED", resource: "Product", resourceId: productId, metadata: { files: sorted.length, roles: sorted.map((f) => f.role) } } });
      return created;
    });
    imported.push({ model: sorted[0].model, files: assets.length });
  }
  return NextResponse.json({ imported, unmatched });
}
