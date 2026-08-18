import "server-only";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = () => path.resolve(process.env.LOCAL_STORAGE_ROOT ?? ".data/uploads");
export function safeObjectKey(tenantId: string, id: string, extension: string) { return `${tenantId}/${id}${extension.replace(/[^a-zA-Z0-9.]/g, "")}`; }
export function resolveLocalObjectPath(objectKey: string) { const target = path.join(root(), objectKey); if (!target.startsWith(root())) throw new Error("INVALID_OBJECT_KEY"); return target; }
export async function putLocalObject(objectKey: string, bytes: Uint8Array) { const target = resolveLocalObjectPath(objectKey); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); }
export async function getLocalObject(objectKey: string) { return readFile(resolveLocalObjectPath(objectKey)); }
