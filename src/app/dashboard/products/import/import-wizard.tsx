"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileUp, PlayCircle } from "lucide-react";

type Category = { slug: string; nameZh: string; nameEn: string | null };
type Issue = { row: number; level: "error" | "warning"; message: string };
type Preview = { rows: { row: number; model: string; sku: string; nameZh: string }[]; issues: Issue[]; valid: number; warnings: number; errors: number };
type Result = { succeeded: { model: string; skus: number }[]; failed: { model: string; reason: string }[]; total: number };
type ImageResult = { imported: { model: string; files: number }[]; unmatched: string[] };

export function ImportWizard({ categories }: { categories: Category[] }) {
  const [category, setCategory] = useState(categories[0]?.slug ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [imageError, setImageError] = useState("");

  async function onZipChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true); setImageError(""); setImageResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/products/import-images", { method: "POST", body: fd });
    const data = await res.json();
    setImageBusy(false);
    if (!res.ok) { setImageError(data.error ?? "图片包上传失败"); return; }
    setImageResult(data as ImageResult);
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setFileError(""); setPreview(null); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/products/import-parse", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setFileError(data.error ?? "解析失败"); return; }
    setPreview(data as Preview);
  }

  async function confirm() {
    if (!preview || preview.rows.length === 0) return;
    setBusy(true); setResult(null);
    const res = await fetch("/api/products/import-confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: preview.rows }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setFileError(data.error ?? "导入失败"); return; }
    setResult(data as Result);
    setPreview(null);
  }

  return (
    <section className="form-card">
      <div className="form-card-title"><div><h2>三步批量导入</h2><p>① 按分类下载空白模板 → ② 填写并上传预览 → ③ 确认入库。参数列头用模板字段 key，模板已含示例行与说明行。</p></div><span><FileUp /></span></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm"><span className="text-neutral-400">产品分类（决定参数列）</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 focus:border-amber-500/60 focus:outline-none">
            {categories.map((c) => <option value={c.slug} key={c.slug}>{c.nameZh} / {c.nameEn ?? c.nameZh}</option>)}
          </select>
        </label>
        <a className="flex items-center gap-1.5 rounded bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700" href={`/api/products/import-template?category=${category}`}><Download size={15} />下载空白模板</a>
        <label className="flex cursor-pointer items-center gap-1.5 rounded bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-500"><FileUp size={15} />{busy ? "处理中…" : "选择文件并预览"}<input type="file" accept=".xlsx" className="hidden" onChange={onFileChange} disabled={busy} /></label>
      </div>
      {fileError && <div className="form-error mt-3">{fileError}</div>}
      {preview && (
        <div className="pt-4">
          <div className="mb-2 flex flex-wrap gap-3 text-sm"><b className="text-emerald-500">{preview.valid} 行可导入</b><span className="text-amber-500">{preview.warnings} 警告</span><span className="text-red-500">{preview.errors} 错误</span></div>
          {preview.issues.length > 0 && (
            <div className="mb-3 max-h-48 overflow-auto rounded border border-neutral-800 p-2 text-xs">
              {preview.issues.map((iss, i) => <p key={i} className={iss.level === "error" ? "text-red-400" : "text-amber-400"}>第 {iss.row} 行{iss.level === "error" ? "错误" : "警告"}：{iss.message}</p>)}
            </div>
          )}
          <button className="flex items-center gap-1.5 rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50" onClick={confirm} disabled={preview.rows.length === 0 || busy}><PlayCircle size={15} />确认导入 {preview.rows.length} 行</button>
        </div>
      )}
      {result && (
        <div className="pt-4 text-sm">
          <div className="save-notice">导入完成：成功 {result.succeeded.length} 个产品（共 {result.succeeded.reduce((n, s) => n + s.skus, 0)} 个 SKU），跳过 {result.failed.length} 个。</div>
          {result.failed.length > 0 && (
            <div className="mt-2 max-h-40 overflow-auto rounded border border-neutral-800 p-2 text-xs">{result.failed.map((f, i) => <p key={i} className="text-red-400">{f.model}：{f.reason}</p>)}</div>
          )}
          <div className="mt-4 rounded border border-neutral-800 p-3">
            <p className="font-medium">④ 图片包（可选）</p>
            <p className="mt-1 text-xs text-neutral-400">打包为 zip（≤100MB），文件名以型号开头即可自动归入对应产品：`XW30-1.jpg` → 画廊；`XW30-尺寸图.jpg` → 尺寸图；`XW30-封面.jpg` → 封面。</p>
            <label className="mt-2 flex w-fit cursor-pointer items-center gap-1.5 rounded bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"><FileUp size={15} />{imageBusy ? "上传处理中…" : "选择 zip 图片包"}<input type="file" accept=".zip" className="hidden" onChange={onZipChange} disabled={imageBusy} /></label>
            {imageError && <div className="form-error mt-2">{imageError}</div>}
            {imageResult && (
              <div className="mt-2 text-xs">
                <p className="text-emerald-500">已导入 {imageResult.imported.length} 个产品的图片（共 {imageResult.imported.reduce((n, s) => n + s.files, 0)} 个文件）。</p>
                {imageResult.unmatched.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-auto rounded border border-neutral-800 p-2">
                    <p className="text-amber-500">以下文件未匹配到型号或被跳过：</p>
                    {imageResult.unmatched.map((f, i) => <p key={i} className="text-neutral-400">{f}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <Link className="mt-3 inline-block rounded border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600" href="/dashboard/products">返回产品列表</Link>
        </div>
      )}
    </section>
  );
}
