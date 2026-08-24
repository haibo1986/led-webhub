// 产品资料分区的单一事实来源（后台上传 + 公开站展示共用）。
// 不改 schema，分区靠 ProductAsset.role 字符串在查询/渲染层划分。
export const ASSET_ROLES = { IMAGE: "IMAGE", CAD: "CAD", DOCUMENT: "DOCUMENT", PHOTOMETRY: "PHOTOMETRY" } as const;

export type Partition = {
  key: string;
  roles: readonly string[];
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  accept: string;
};

export const PARTITIONS: Partition[] = [
  { key: "IMAGE", roles: ["IMAGE"], titleZh: "产品图片", titleEn: "Product images", descriptionZh: "主图与产品照片；公开站以大图轮播 + 缩略图展示。", accept: ".jpg,.jpeg,.png,.webp" },
  { key: "CAD", roles: ["CAD"], titleZh: "尺寸图", titleEn: "Dimension drawings", descriptionZh: "工程图纸：图片格式公开站直接展示，DWG/DXF/STEP 以文件下载。", accept: ".jpg,.jpeg,.png,.webp,.dwg,.dxf,.step" },
  { key: "DOCUMENT", roles: ["DOCUMENT", "PHOTOMETRY"], titleZh: "技术规格资料", titleEn: "Technical documents", descriptionZh: "规格书 PDF 与光度文件（IES/LDT）；公开站以文件列表下载。", accept: ".pdf,.ies,.ldt,.dwg,.dxf,.step" },
];

// role → 中文标签（后台友好展示；未知 role 回退为原字符串）
export const ROLE_ZH: Record<string, string> = { IMAGE: "产品图片", CAD: "工程图纸", DOCUMENT: "技术文档", PHOTOMETRY: "光度文件" };

export function isImageAsset(asset: { mimeType: string }) {
  return asset.mimeType.startsWith("image/");
}

type AssetLike = { id: string; fileName: string; mimeType: string; sizeBytes: bigint };
type ProductAssetLike = { role: string; asset: AssetLike };

// 公开站三方分流：画廊(IMAGE 图片) / 尺寸图(CAD 图片) / 下载(DOCUMENT、PHOTOMETRY、CAD 非图片)。
// 未知 role 与误标（IMAGE 但非图片）一律忽略，不显示、不崩。
export function splitPublicAssets(items: ProductAssetLike[]) {
  const gallery: ProductAssetLike[] = [];
  const cadImages: ProductAssetLike[] = [];
  const downloads: ProductAssetLike[] = [];
  for (const pa of items) {
    const image = isImageAsset(pa.asset);
    if (pa.role === ASSET_ROLES.IMAGE && image) gallery.push(pa);
    else if (pa.role === ASSET_ROLES.CAD && image) cadImages.push(pa);
    else if (pa.role === ASSET_ROLES.CAD || pa.role === ASSET_ROLES.DOCUMENT || pa.role === ASSET_ROLES.PHOTOMETRY) downloads.push(pa);
  }
  return { gallery, cadImages, downloads };
}

// 后台按分区过滤
export function byRoles<T extends ProductAssetLike>(items: T[], roles: readonly string[]) {
  return items.filter((pa) => roles.includes(pa.role));
}
