"use client";

import { ImagePlus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CaseImage = { assetId: string; fileName: string; role: string };

export function CaseImages({ caseId, images }: { caseId: string; images: CaseImage[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setCover(assetId: string) {
    setBusy(true);
    try {
      await fetch(`/api/projects/${caseId}/assets?assetId=${assetId}`, { method: "PATCH" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(assetId: string) {
    if (!confirm("移除这张图片？移除后公开站不再展示。")) return;
    setBusy(true);
    try {
      await fetch(`/api/projects/${caseId}/assets?assetId=${assetId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <div className="case-images">
    <form className="asset-upload" action={`/api/projects/${caseId}/assets`} method="post" encType="multipart/form-data">
      <label>选择图片（可多次上传，支持 JPG/PNG/WebP，最大 25MB）<input name="file" type="file" accept=".jpg,.jpeg,.png,.webp" required /></label>
      <label>图片角色<select name="role"><option value="IMAGE">画廊图片</option><option value="COVER">封面（列表与详情主图）</option></select></label>
      <button disabled={busy}><ImagePlus />上传图片</button>
    </form>
    <div className="case-image-grid">
      {images.map((img) => <figure key={img.assetId} className={img.role === "COVER" ? "is-cover" : ""}>
        <img src={`/api/assets/${img.assetId}`} alt={img.fileName} loading="lazy" />
        <figcaption>{img.role === "COVER" ? "封面" : "画廊"}{img.fileName ? ` · ${img.fileName}` : ""}</figcaption>
        <div className="case-image-actions">
          {img.role !== "COVER" && <button disabled={busy} onClick={() => setCover(img.assetId)} title="设为封面"><Star />设为封面</button>}
          <button disabled={busy} className="danger" onClick={() => remove(img.assetId)} title="移除"><Trash2 /></button>
        </div>
      </figure>)}
      {images.length === 0 && <p className="asset-empty">尚未上传案例图片。首张建议设为封面，会显示在案例列表卡片上。</p>}
    </div>
  </div>;
}
