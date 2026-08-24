import { Download, FileText, FileUp, Images, Ruler } from "lucide-react";
import { isImageAsset, ROLE_ZH, type Partition } from "@/lib/asset-roles";

type AssetItem = { role: string; asset: { id: string; fileName: string; mimeType: string; sizeBytes: bigint; visibility: string } };

export function AssetPartition({ productId, partition, items, showThumb, allowRoleChoice }: {
  productId: string;
  partition: Partition;
  items: AssetItem[];
  showThumb?: boolean;
  allowRoleChoice?: boolean;
}) {
  const icon = partition.key === "IMAGE" ? <Images /> : partition.key === "CAD" ? <Ruler /> : <FileText />;
  return (
    <div className="asset-partition">
      <h3 className="asset-partition-title">{icon}<span>{partition.titleZh}<small>{partition.descriptionZh}</small></span></h3>
      <form className="asset-upload" action={`/api/products/${productId}/assets`} method="post" encType="multipart/form-data">
        <label>选择文件<input name="file" type="file" required accept={partition.accept} /></label>
        {allowRoleChoice ? (
          <label>文件角色<select name="role"><option value="DOCUMENT">技术文档（规格书 PDF）</option><option value="PHOTOMETRY">光度文件（IES/LDT）</option></select></label>
        ) : (
          <input type="hidden" name="role" value={partition.roles[0]} />
        )}
        <label>访问级别<select name="visibility"><option value="INTERNAL">内部</option><option value="PUBLIC">公开免登录</option><option value="CONTROLLED">受控下载</option></select></label>
        <button><FileUp />上传并关联</button>
      </form>
      <div className="asset-list">
        {items.map(({ asset, role }) => (
          <div key={asset.id}>
            <span>
              {showThumb && isImageAsset(asset) ? <img className="asset-thumb" src={`/api/assets/${asset.id}`} alt="" /> : <Download />}
              <div><b>{asset.fileName}</b><small>{ROLE_ZH[role] ?? role} · {(Number(asset.sizeBytes) / 1024 / 1024).toFixed(2)} MB</small></div>
            </span>
            <em className={`visibility-${asset.visibility.toLowerCase()}`}>{asset.visibility}</em>
            <a href={`/api/assets/${asset.id}`}>下载</a>
          </div>
        ))}
        {items.length === 0 && <p className="asset-empty">尚未上传文件。</p>}
      </div>
    </div>
  );
}
