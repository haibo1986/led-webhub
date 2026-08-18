import Link from "next/link";
import { ArrowLeft, Building2, Globe2, Images, LayoutDashboard, LogOut, MessageSquareText, Newspaper, Package, Settings2 } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { requireSession } from "@/lib/auth/dal";

export async function AdminPage({ title, eyebrow, tenant, children, action }: { title: string; eyebrow: string; tenant: string; children: React.ReactNode; action?: React.ReactNode }) {
  const session = await requireSession();
  return <main className="crud-shell"><aside className="crud-side"><Link href="/dashboard" className="admin-brand"><span className="brand-mark"><span/></span><div><b>LED WebHub</b><small>{tenant}</small></div></Link><nav><Link href="/dashboard"><LayoutDashboard/>工作台</Link><Link href="/dashboard/products"><Package/>产品资料</Link><Link href="/dashboard/projects"><Images/>应用案例</Link><Link href="/dashboard/news"><Newspaper/>新闻资讯</Link><Link href="/dashboard/inquiries"><MessageSquareText/>项目询盘</Link><Link href="/dashboard/settings"><Settings2/>企业设置</Link>{session.role === "PLATFORM_ADMIN" && <Link href="/dashboard/platform"><Building2/>平台管理</Link>}<Link href="/zh-CN"><Globe2/>查看官网</Link></nav><form action={logoutAction}><button><LogOut/>退出登录</button></form></aside><section className="crud-main"><header><div><p>{eyebrow}</p><h1>{title}</h1></div>{action}</header><Link className="mobile-dashboard-back" href="/dashboard"><ArrowLeft/>返回工作台</Link>{children}</section></main>;
}
