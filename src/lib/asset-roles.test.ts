import { describe, expect, it } from "vitest";
import { ASSET_ROLES, byRoles, PARTITIONS, splitPublicAssets } from "./asset-roles";

const asset = (role: string, mimeType: string, id = role + mimeType.replace("/", "-")) => ({ role, asset: { id, fileName: `${id}.bin`, mimeType, sizeBytes: BigInt(1) } });

describe("splitPublicAssets（公开站三方分流）", () => {
  it("IMAGE 图片进画廊；CAD 图片进尺寸图；CAD/DOCUMENT/PHOTOMETRY 其余进下载", () => {
    const items = [
      asset(ASSET_ROLES.IMAGE, "image/jpeg", "a"),
      asset(ASSET_ROLES.CAD, "image/png", "b"),
      asset(ASSET_ROLES.CAD, "application/octet-stream", "c"),
      asset(ASSET_ROLES.DOCUMENT, "application/pdf", "d"),
      asset(ASSET_ROLES.PHOTOMETRY, "text/plain", "e"),
    ];
    const { gallery, cadImages, downloads } = splitPublicAssets(items);
    expect(gallery.map((x) => x.asset.id)).toEqual(["a"]);
    expect(cadImages.map((x) => x.asset.id)).toEqual(["b"]);
    expect(downloads.map((x) => x.asset.id)).toEqual(["c", "d", "e"]);
  });

  it("误标 IMAGE 但非图片的资产被忽略（不显示、不崩）", () => {
    const { gallery, cadImages, downloads } = splitPublicAssets([asset(ASSET_ROLES.IMAGE, "application/pdf", "x")]);
    expect(gallery).toEqual([]);
    expect(cadImages).toEqual([]);
    expect(downloads).toEqual([]);
  });

  it("未知 role 一律忽略", () => {
    const { gallery, cadImages, downloads } = splitPublicAssets([asset("LEGACY", "image/jpeg", "y")]);
    expect(gallery).toEqual([]);
    expect(cadImages).toEqual([]);
    expect(downloads).toEqual([]);
  });
});

describe("byRoles（后台分区过滤）", () => {
  it("按分区 roles 过滤，DOCUMENT 分区包含 PHOTOMETRY", () => {
    const items = [asset(ASSET_ROLES.DOCUMENT, "application/pdf"), asset(ASSET_ROLES.PHOTOMETRY, "text/plain")];
    const docPartition = PARTITIONS[2];
    expect(byRoles(items, docPartition.roles).map((x) => x.role)).toEqual([ASSET_ROLES.DOCUMENT, ASSET_ROLES.PHOTOMETRY]);
  });
});
