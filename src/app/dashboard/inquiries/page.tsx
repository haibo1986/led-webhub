import Link from "next/link";
import { Mail, MessageSquareText, Phone } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../components/admin-page";
import { setInquiryStatusAction } from "./actions";

const labels = { NEW: "新询盘", VIEWED: "已查看", FOLLOWING: "跟进中", COMPLETED: "已完成", INVALID: "无效" } as const;
const STATUSES = ["NEW", "VIEWED", "FOLLOWING", "COMPLETED", "INVALID"] as const;
type InquiryStatus = (typeof STATUSES)[number];
const PAGE_SIZE = 20;

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const session = await requirePermission("inquiry:read");
  const query = await searchParams;
  const status = STATUSES.includes(query.status as InquiryStatus) ? (query.status as InquiryStatus) : undefined;
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const where = { tenantId: session.tenantId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    getDb().inquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { emailLogs: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    getDb().inquiry.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => `/dashboard/inquiries?${new URLSearchParams({ ...(status ? { status } : {}), page: String(target) }).toString()}`;
  return <AdminPage title="项目询盘" eyebrow="INQUIRY DESK" tenant={session.tenant.name}>
    <div className="list-toolbar"><div><MessageSquareText /><div><b>{total}</b><span> 条询盘</span></div></div><p>仅显示当前企业收到的公开表单提交</p></div>
    <nav className="catalog-filters">{( [undefined, ...STATUSES] as (InquiryStatus | undefined)[]).map((item) => <Link className={status === item ? "active" : ""} href={`/dashboard/inquiries${item ? `?status=${item}` : ""}`} key={item ?? "all"}>{item ? labels[item] : "全部"}</Link>)}</nav>
    <section className="inquiry-list">{items.map(item => { const emailLog = item.emailLogs[0]; const mailBadge = !emailLog ? { key: "none", zh: "未通知" } : emailLog.status === "SENT" ? { key: "sent", zh: "邮件已通知" } : emailLog.status === "FAILED" ? { key: "failed", zh: "邮件发送失败" } : { key: "skipped", zh: "未配置通知" }; return <article key={item.id}><header><div><b>{item.name}</b><span>{item.company || "个人客户"} · {item.country || "未填写地区"}</span></div><em className={`inquiry-${item.status.toLowerCase()}`}>{labels[item.status]}</em><em className={`mail-${mailBadge.key}`}>{mailBadge.zh}</em></header><p>{item.message}</p><footer><a href={`mailto:${item.email}`}><Mail />{item.email}</a>{item.phone && <a href={`tel:${item.phone}`}><Phone />{item.phone}</a>}<time>{item.createdAt.toLocaleString("zh-CN")}</time></footer><div>{( ["VIEWED", "FOLLOWING", "COMPLETED", "INVALID"] as const).map(s => <form action={setInquiryStatusAction.bind(null, item.id, s)} key={s}><button disabled={item.status === s}>{labels[s]}</button></form>)}</div></article>; })}{!items.length && <p className="resource-empty">{status ? "该状态下没有询盘。" : "暂时没有项目询盘。"}</p>}</section>
    {totalPages > 1 && <nav className="catalog-pagination flex items-center justify-center gap-4 pt-6 text-sm">{page > 1 && <Link className="rounded border border-neutral-800 px-4 py-2 text-neutral-300 hover:border-neutral-600" href={pageHref(page - 1)}>← 上一页</Link>}<span className="text-neutral-500">{page} / {totalPages}</span>{page < totalPages && <Link className="rounded border border-neutral-800 px-4 py-2 text-neutral-300 hover:border-neutral-600" href={pageHref(page + 1)}>下一页 →</Link>}</nav>}
  </AdminPage>;
}
