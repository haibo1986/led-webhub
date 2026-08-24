"use client";

import Link from "next/link";
import { ChevronDown, Languages, Menu, MoveUpRight, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { SiteLocale } from "@/lib/public-site";
import type { NavPage } from "@/lib/site-config";

type Category = { slug: string; nameZh: string; nameEn: string | null };
export type NavItem = { id: string; type: "page" | "link"; page?: NavPage; labelZh: string; labelEn: string; href?: string; enabled: boolean };

// 内置页面 → 公开站路径（导航配置只存 page key，路径在此集中映射）
const PAGE_PATH: Record<NavPage, (locale: SiteLocale) => string> = {
  home: (l) => `/${l}`,
  about: (l) => `/${l}/about`,
  capabilities: (l) => `/${l}/capabilities`,
  products: (l) => `/${l}/products`,
  projects: (l) => `/${l}/projects`,
  resources: (l) => `/${l}/resources`,
  news: (l) => `/${l}/news`,
  contact: (l) => `/${l}/contact`,
};

export function PublicNavigation({ locale, tenantName, categories, items }: { locale: SiteLocale; tenantName: string; categories: Category[]; items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zh = locale === "zh-CN";
  const other = zh ? "en" : "zh-CN";
  // 语言切换保留查询参数（如 ?category=xx / ?q=xx）
  const languageHref = `${pathname.replace(/^\/(zh-CN|en)/, `/${other}`)}${searchParams.size ? `?${searchParams}` : ""}`;
  const hrefFor = (item: NavItem) => (item.type === "link" ? (item.href ?? `/${locale}`) : PAGE_PATH[item.page ?? "home"](locale));
  const labelFor = (item: NavItem) => (zh ? item.labelZh : item.labelEn);
  const visible = items.filter((item) => item.enabled);
  const productIndex = visible.findIndex((item) => item.type === "page" && item.page === "products");

  return <header className="public-nav">
    <Link href={`/${locale}`} className="brand-lockup" onClick={() => setOpen(false)}><span className="brand-mark"><span/></span><span>{tenantName}</span></Link>
    <nav className="desktop-public-links">
      {visible.map((item, index) => {
        if (index === productIndex) return <div key={item.id} className="product-nav-group"><Link href={hrefFor(item)}>{labelFor(item)}<ChevronDown/></Link><div className="product-mega"><div><p>{zh ? "产品系统" : "PRODUCT SYSTEMS"}</p><strong>{zh ? "按真实产品分类浏览" : "Browse by product category"}</strong><Link href={`/${locale}/products`}>{zh ? "查看全部产品" : "View all products"}<MoveUpRight/></Link></div><div>{categories.map((category, ci) => <Link href={`/${locale}/products?category=${category.slug}`} key={category.slug}><span>0{ci + 1}</span>{zh ? category.nameZh : (category.nameEn ?? category.nameZh)}</Link>)}</div></div></div>;
        return <Link href={hrefFor(item)} key={item.id}>{labelFor(item)}</Link>;
      })}
    </nav>
    <div className="public-nav-actions"><Link href={languageHref}><Languages/>{zh ? "EN" : "中文"}</Link><Link className="admin-link" href="/dashboard">{zh ? "管理后台" : "Admin"}<MoveUpRight/></Link><button className="mobile-menu-trigger" onClick={() => setOpen(!open)} aria-label={zh ? "打开导航" : "Open navigation"}>{open ? <X/> : <Menu/>}</button></div>
    <div className={`mobile-public-menu ${open ? "open" : ""}`}><p>{zh ? "导航" : "NAVIGATION"}</p>{visible.map((item, index) => <Link href={hrefFor(item)} key={item.id} onClick={() => setOpen(false)}><span>0{index + 1}</span>{labelFor(item)}</Link>)}<div><Link href={languageHref}>{zh ? "English website" : "中文网站"}</Link><Link href="/dashboard">{zh ? "进入管理后台" : "Open admin"}</Link></div></div>
  </header>;
}
