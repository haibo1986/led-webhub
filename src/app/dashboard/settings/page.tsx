import { CheckCircle2, Download, Languages, Palette, Save } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { AdminPage } from "../components/admin-page";
import { updateSettingsAction } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await requirePermission("tenant:manage");
  const tenant = await getDb().tenant.findUniqueOrThrow({ where: { id: session.tenantId }, select: { name: true, shortName: true, description: true, email: true, phone: true, address: true, primaryColor: true, secondaryColor: true, publicDownloads: true } });
  const state = await searchParams;
  return <AdminPage title="企业与网站设置" eyebrow="TENANT CONFIGURATION" tenant={tenant.name}>
    {state.saved && <div className="save-notice"><CheckCircle2/>设置已保存，新的品牌配置将在下次发布时应用。</div>}{state.error && <div className="form-error">提交内容不完整，请检查邮箱和颜色格式。</div>}
    <form action={updateSettingsAction} className="settings-form"><section className="form-card"><div className="form-card-title"><div><h2>基础资料</h2><p>用于官网、页脚、询盘通知和 SEO 默认信息。</p></div><span>01</span></div><div className="form-grid"><label>企业全称<input name="name" defaultValue={tenant.name} required/></label><label>企业简称<input name="shortName" defaultValue={tenant.shortName ?? ""}/></label><label className="wide">企业简介<textarea name="description" defaultValue={tenant.description ?? ""} rows={4}/></label><label>公开邮箱<input name="email" type="email" defaultValue={tenant.email ?? ""}/></label><label>联系电话<input name="phone" defaultValue={tenant.phone ?? ""}/></label><label className="wide">联系地址<input name="address" defaultValue={tenant.address ?? ""}/></label></div></section>
      <section className="form-card"><div className="form-card-title"><div><h2>品牌外观</h2><p>首套模板以主色作为灯光强调，以辅助色承载深色区域。</p></div><Palette/></div><div className="color-grid"><label><span style={{background:tenant.primaryColor}}/><div>主品牌色<small>按钮、状态与光线强调</small></div><input name="primaryColor" defaultValue={tenant.primaryColor} pattern="#[0-9A-Fa-f]{6}"/></label><label><span style={{background:tenant.secondaryColor}}/><div>辅助色<small>导航、页脚与深色背景</small></div><input name="secondaryColor" defaultValue={tenant.secondaryColor} pattern="#[0-9A-Fa-f]{6}"/></label></div></section>
      <section className="form-card compact"><div className="setting-toggle"><Download/><div><b>公开资料免登录下载</b><p>开启后，标记为“公开”的 PDF、IES、LDT 与 CAD 可直接下载；内部资料始终需要权限。</p></div><label className="switch"><input name="publicDownloads" type="checkbox" defaultChecked={tenant.publicDownloads}/><span/></label></div><div className="setting-toggle disabled"><Languages/><div><b>简体中文 + English</b><p>两种语言独立维护、预览和发布，缺失内容不会自动替代。</p></div><em>已启用</em></div></section>
      <div className="sticky-save"><p>保存不会直接修改已发布页面，需通过发布流程更新官网。</p><button><Save/>保存设置</button></div>
    </form>
  </AdminPage>;
}
