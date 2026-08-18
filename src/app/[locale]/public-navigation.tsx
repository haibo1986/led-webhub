"use client";

import Link from "next/link";
import { ChevronDown, Languages, Menu, MoveUpRight, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { SiteLocale } from "@/lib/public-site";

type Category = { slug: string; nameZh: string; nameEn: string | null };

export function PublicNavigation({ locale, tenantName, categories }: { locale: SiteLocale; tenantName: string; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zh = locale === "zh-CN";
  const other = zh ? "en" : "zh-CN";
  // 语言切换保留查询参数（如 ?category=xx / ?q=xx）
  const languageHref = `${pathname.replace(/^\/(zh-CN|en)/, `/${other}`)}${searchParams.size ? `?${searchParams}` : ""}`;
  const items = [
    [zh ? "首页" : "Home", `/${locale}`],
    [zh ? "关于我们" : "About", `/${locale}/about`],
    [zh ? "核心竞争力" : "Capabilities", `/${locale}/capabilities`],
    [zh ? "应用案例" : "Projects", `/${locale}/projects`],
    [zh ? "技术支持" : "Resources", `/${locale}/resources`],
    [zh ? "新闻资讯" : "News", `/${locale}/news`],
    [zh ? "联系我们" : "Contact", `/${locale}/contact`],
  ] as const;

  return <header className="public-nav">
    <Link href={`/${locale}`} className="brand-lockup" onClick={() => setOpen(false)}><span className="brand-mark"><span/></span><span>{tenantName}</span></Link>
    <nav className="desktop-public-links">
      {items.slice(0, 2).map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
      <div className="product-nav-group"><Link href={`/${locale}/products`}>{zh ? "产品中心" : "Products"}<ChevronDown/></Link><div className="product-mega"><div><p>{zh ? "产品系统" : "PRODUCT SYSTEMS"}</p><strong>{zh ? "按真实产品分类浏览" : "Browse by product category"}</strong><Link href={`/${locale}/products`}>{zh ? "查看全部产品" : "View all products"}<MoveUpRight/></Link></div><div>{categories.map((category, index) => <Link href={`/${locale}/products?category=${category.slug}`} key={category.slug}><span>0{index + 1}</span>{zh ? category.nameZh : (category.nameEn ?? category.nameZh)}</Link>)}</div></div></div>
      {items.slice(2).map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
    </nav>
    <div className="public-nav-actions"><Link href={languageHref}><Languages/>{zh ? "EN" : "中文"}</Link><Link className="admin-link" href="/dashboard">{zh ? "管理后台" : "Admin"}<MoveUpRight/></Link><button className="mobile-menu-trigger" onClick={() => setOpen(!open)} aria-label={zh ? "打开导航" : "Open navigation"}>{open ? <X/> : <Menu/>}</button></div>
    <div className={`mobile-public-menu ${open ? "open" : ""}`}><p>{zh ? "导航" : "NAVIGATION"}</p>{items.slice(0, 2).map(([label, href], index) => <Link href={href} key={href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{label}</Link>)}<Link href={`/${locale}/products`} onClick={() => setOpen(false)}><span>03</span>{zh ? "产品中心" : "Products"}</Link>{items.slice(2).map(([label, href], index) => <Link href={href} key={href} onClick={() => setOpen(false)}><span>0{index + 4}</span>{label}</Link>)}<div><Link href={languageHref}>{zh ? "English website" : "中文网站"}</Link><Link href="/dashboard">{zh ? "进入管理后台" : "Open admin"}</Link></div></div>
  </header>;
}
