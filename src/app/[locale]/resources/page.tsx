import type { Metadata } from "next";
import { Download, FileBox, FileText, Ruler, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPublicTenant, isSiteLocale, localeToDb } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/resources">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  return publicMetadata(locale, "/resources", { "zh-CN": "技术资料", en: "Technical resources" }, { description: { "zh-CN": "直接下载企业公开发布的产品资料、光度文件与工程图纸。", en: "Download product documents, photometry and engineering drawings released for public use." } });
}

export default async function ResourcesPage({ params }: PageProps<"/[locale]/resources">) {
  const { locale } = await params; if (!isSiteLocale(locale)) notFound(); const tenant = await getPublicTenant(); const zh = locale === "zh-CN"; const dbLocale = localeToDb[locale];
  const assets = tenant.publicDownloads ? await getDb().asset.findMany({ where: { tenantId: tenant.id, visibility: "PUBLIC", deletedAt: null, products: { some: { product: { status: "PUBLISHED", deletedAt: null, translations: { some: { locale: dbLocale, isPublished: true } } } } } }, orderBy: { createdAt: "desc" }, include: { products: { take: 1, include: { product: { include: { translations: { where: { locale: dbLocale }, take: 1 } } } } } } }) : [];
  return <main className="resource-page"><section className="inner-hero resource-hero"><p>TECHNICAL RESOURCES</p><h1>{zh ? "工程资料，一处获取。" : "Engineering resources, in one place."}</h1><span>{zh ? "直接下载企业明确标记为公开的产品资料、光度文件与工程图纸。" : "Download product documents, photometry and drawings explicitly released for public use."}</span></section><section className="resource-types"><article><FileText/><b>PDF</b><span>{zh ? "规格书与安装说明" : "Datasheets & instructions"}</span></article><article><Ruler/><b>IES · LDT</b><span>{zh ? "光度与配光数据" : "Photometric data"}</span></article><article><FileBox/><b>CAD · STEP</b><span>{zh ? "工程与结构图纸" : "Engineering drawings"}</span></article><article><ShieldCheck/><b>VERIFIED</b><span>{zh ? "企业公开发布" : "Enterprise published"}</span></article></section><section className="resource-library"><header><div><p>PUBLIC LIBRARY</p><h2>{zh ? "公开资料库" : "Public library"}</h2></div><span>{assets.length} {zh ? "份文件" : "files"}</span></header><div>{assets.map(asset => { const product = asset.products[0]?.product; return <a href={`/api/assets/${asset.id}`} key={asset.id}><FileText/><div><b>{asset.fileName}</b><span>{product?.translations[0]?.name ?? product?.model} · {(Number(asset.sizeBytes)/1024/1024).toFixed(2)} MB</span></div><Download/></a> })}{assets.length === 0 && <p className="resource-empty">{zh ? "当前没有可公开下载的资料。" : "No public resources are available."}</p>}</div></section></main>;
}
