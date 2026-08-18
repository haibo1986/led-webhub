import Link from "next/link";
import { ArrowRight, CheckCircle2, Globe2, MessageSquareText, Package, Plus, Settings2 } from "lucide-react";
import { requireSession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { localeToDb } from "@/lib/public-site";
import { AdminPage } from "./components/admin-page";

const statusLabel = { DRAFT: "草稿", PUBLISHED: "已发布", UNPUBLISHED: "已下架", ARCHIVED: "已归档" } as const;
// 发布覆盖率公式：基础分 10 + 已发布占比 × 90（未发布任何产品时为 0）
const COVERAGE_BASE = 10;
const COVERAGE_RATIO = 90;
const LANGUAGE_COUNT = Object.keys(localeToDb).length;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await requireSession();
  const [published, total, inquiries, recent] = await Promise.all([
    getDb().product.count({ where: { tenantId: session.tenantId, status: "PUBLISHED", deletedAt: null } }),
    getDb().product.count({ where: { tenantId: session.tenantId, deletedAt: null } }),
    getDb().inquiry.count({ where: { tenantId: session.tenantId, status: { in: ["NEW", "VIEWED", "FOLLOWING"] } } }),
    getDb().product.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5, include: { translations: { where: { locale: "ZH_CN" }, take: 1 }, _count: { select: { variants: true, assets: true } } } }),
  ]);
  const completeness = total ? Math.min(100, Math.round(COVERAGE_BASE + (published / total) * COVERAGE_RATIO)) : 0;
  return <AdminPage title={`你好，${session.user.name}`} eyebrow="TENANT COMMAND CENTER" tenant={session.tenant.name} action={<Link className="primary-action" href="/dashboard/products/new"><Plus/>新增产品</Link>}>
    {error === "forbidden" && <div className="form-error">你没有执行该操作的权限，已返回工作台。</div>}
    <section className="live-dashboard-intro"><div><p>当前工作空间</p><h2>{session.tenant.name}</h2><span>所有统计仅来自当前租户，跨租户查询由服务端数据层阻断。</span></div><Link href="/dashboard/settings"><Settings2/>配置企业资料 <ArrowRight/></Link></section>
    <div className="metric-grid live-metrics"><article><p>已发布产品 <span>可在官网展示</span></p><div><b>{published}</b><Package/></div><small>共 {total} 个有效产品</small></article><article><p>待处理询盘 <span>需要跟进</span></p><div><b>{inquiries}</b><MessageSquareText/></div><small>新询盘、已查看与跟进中</small></article><article><p>发布覆盖率 <span>目标 ≥ 90%</span></p><div><b>{completeness}<em>%</em></b><CheckCircle2/></div><div className="progress"><i style={{width:`${completeness}%`}}/></div></article><article><p>官网语言 <span>独立发布</span></p><div><b>{LANGUAGE_COUNT}</b><Globe2/></div><small>简体中文 / English</small></article></div>
    <section className="panel live-recent"><div className="panel-head"><div><h2>最近产品</h2><p>最近编辑或发布的产品资料</p></div><Link href="/dashboard/products">查看全部</Link></div>{recent.map((product) => <Link href={`/dashboard/products/${product.id}`} key={product.id} className="recent-product-row"><span>{product.model.slice(0,2)}</span><div><b>{product.translations[0]?.name ?? product.model}</b><small>{product.model} · {product._count.variants} SKU · {product._count.assets} 份资料</small></div><em className={`status-${product.status.toLowerCase()}`}>{statusLabel[product.status]}</em><ArrowRight/></Link>)}{recent.length === 0 && <div className="empty-products"><Package/><h2>从第一个产品开始</h2><p>创建产品、中文与英文内容，以及至少一个 SKU。</p><Link href="/dashboard/products/new">新增产品</Link></div>}</section>
  </AdminPage>;
}
