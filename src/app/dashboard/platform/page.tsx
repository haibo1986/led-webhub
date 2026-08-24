import { Building2, Globe, Plus, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../components/admin-page";
import { addDomainAction, createTenantAction, deleteDomainAction, setDomainVerifiedAction, setTenantStatusAction } from "./actions";

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; saved?: string }> }) {
  const session = await requirePermission("platform:manage");
  const state = await searchParams;
  const [tenants, domains, auditLogs] = await Promise.all([
    getDb().tenant.findMany({ orderBy: { createdAt: "desc" }, include: { domains: { where: { isPrimary: true }, take: 1 }, _count: { select: { memberships: true, products: true, inquiries: true } } } }),
    getDb().domain.findMany({ orderBy: [{ tenant: { name: "asc" } }, { createdAt: "asc" }], include: { tenant: { select: { id: true, name: true } } } }),
    getDb().auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { tenant: { select: { name: true } }, actor: { select: { email: true } } } }),
  ]);
  return <AdminPage title="平台运营" eyebrow="PLATFORM OPS" tenant={session.tenant.name}>
    {state.created && <div className="save-notice">租户已开通，管理员可使用表单中填写的邮箱与密码登录。</div>}
    {state.saved === "domain" && <div className="save-notice">域名操作已完成。</div>}
    {state.error === "duplicate" && <div className="form-error">该租户 slug 或域名已存在，请更换。</div>}
    {state.error === "domain_duplicate" && <div className="form-error">该域名已被其他租户绑定。</div>}
    {state.error && state.error !== "duplicate" && state.error !== "domain_duplicate" && <div className="form-error">请检查必填项、邮箱与密码格式（密码至少 8 位）。</div>}
    <section className="form-card">
      <div className="form-card-title"><div><h2>开通新租户</h2><p>同时创建企业管理员账号、主域名与初始状态（试用期）。</p></div><span><Building2 /></span></div>
      <form action={createTenantAction} className="settings-form">
        <div className="form-grid">
          <label>租户标识（slug）<input name="slug" placeholder="例如 acme-lighting" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
          <label>企业名称<input name="name" placeholder="例如 明弧照明" required /></label>
          <label>主域名（hostname）<input name="hostname" placeholder="例如 www.acme.com" required /></label>
          <label>管理员邮箱<input name="adminEmail" type="email" placeholder="admin@acme.com" required /></label>
          <label className="wide">初始密码（至少 8 位，由平台操作员当面/加密渠道告知管理员）<input name="adminPassword" type="password" minLength={8} required /></label>
        </div>
        <div className="sticky-save"><p>开通后租户为试用状态，可在下方启用或停用。</p><button><Plus />开通租户</button></div>
      </form>
    </section>
    <section className="form-card">
      <div className="form-card-title"><div><h2>租户列表（{tenants.length}）</h2><p>停用后该企业所有成员立即无法登录（会话即时失效），公开站仅展示试用与启用租户。</p></div><span>ALL</span></div>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-neutral-800 text-neutral-500"><th className="py-2 pr-4 font-medium">企业</th><th className="py-2 pr-4 font-medium">域名</th><th className="py-2 pr-4 font-medium">状态</th><th className="py-2 pr-4 font-medium">成员</th><th className="py-2 pr-4 font-medium">产品</th><th className="py-2 pr-4 font-medium">询盘</th><th className="py-2 font-medium">操作</th></tr></thead>
        <tbody>{tenants.map(tenant => { const toggle = setTenantStatusAction.bind(null, tenant.id, tenant.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"); return <tr key={tenant.id} className="border-b border-neutral-900"><td className="py-3 pr-4"><b>{tenant.name}</b><small className="block text-neutral-500">{tenant.slug}</small></td><td className="py-3 pr-4 text-neutral-400">{tenant.domains[0]?.hostname ?? "—"}</td><td className="py-3 pr-4"><span className={tenant.status === "ACTIVE" ? "text-emerald-500" : tenant.status === "TRIAL" ? "text-amber-500" : tenant.status === "SUSPENDED" ? "text-red-500" : "text-neutral-500"}>{tenant.status}</span></td><td className="py-3 pr-4">{tenant._count.memberships}</td><td className="py-3 pr-4">{tenant._count.products}</td><td className="py-3 pr-4">{tenant._count.inquiries}</td><td className="py-3"><form action={toggle}><button className="rounded border border-neutral-800 px-3 py-1 text-neutral-300 hover:border-neutral-600">{tenant.status === "SUSPENDED" ? "启用" : "停用"}</button></form></td></tr>; })}</tbody>
      </table>
    </section>
    <section className="form-card">
      <div className="form-card-title"><div><h2>域名管理</h2><p>为租户开通域名并控制验证状态；已验证域名才能作为公开站主入口。取消验证会自动撤销主域名身份。</p></div><span><Globe /></span></div>
      <form action={addDomainAction} className="domain-add-form">
        <select name="tenantId" required>{tenants.map((t) => <option value={t.id} key={t.id}>{t.name}（{t.slug}）</option>)}</select>
        <input name="hostname" placeholder="例如 www.acme.com" required />
        <label className="switch small"><input name="verified" type="checkbox" /><span /> 开通即已验证</label>
        <button><Plus />添加域名</button>
      </form>
      <div className="domain-list platform-domain-list">
        {domains.map((d) => <div key={d.id} className="domain-row">
          <div><b>{d.hostname}</b><small>{d.tenant.name}{d.isPrimary ? " · 主域名" : ""}{d.isVerified ? " · 已验证" : " · 待验证"}</small></div>
          <div className="domain-row-actions">
            <form action={setDomainVerifiedAction.bind(null, d.id, !d.isVerified)}><button className={d.isVerified ? "danger" : ""}>{d.isVerified ? "取消验证" : "标记已验证"}</button></form>
            <form action={deleteDomainAction.bind(null, d.id)}><button className="danger">删除</button></form>
          </div>
        </div>)}
        {!domains.length && <p className="asset-empty">尚未配置任何域名。</p>}
      </div>
    </section>
    <section className="form-card">
      <div className="form-card-title"><div><h2>平台审计（最近 20 条）</h2><p>跨租户操作轨迹：开通、停用、域名变更与租户内关键动作。</p></div><span><ShieldCheck /></span></div>
      <div className="audit-feed">
        {auditLogs.map((log) => <div key={log.id}><em>{log.action}</em><b>{log.resource}{log.resourceId ? `:${log.resourceId}` : ""}</b><span>{log.tenant?.name ?? "平台"} · {log.actor?.email ?? "系统"} · {log.createdAt.toLocaleString("zh-CN")}</span></div>)}
        {!auditLogs.length && <p className="asset-empty">暂无审计记录。</p>}
      </div>
    </section>
  </AdminPage>;
}
