import Link from "next/link";

export default function LocaleNotFound() {
  return <main className="public-empty" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}><p>404 · NOT FOUND</p><h1>页面不存在或已下架。</h1><div style={{ display: "flex", gap: "1rem" }}><Link href="/zh-CN" className="primary-action">返回首页</Link><Link href="/zh-CN/products" className="quiet">浏览产品中心</Link></div></main>;
}
