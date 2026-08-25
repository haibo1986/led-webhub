import { CheckCircle2, ChevronDown, ChevronUp, Download, Globe, Languages, LayoutTemplate, Menu, Palette, Plus, Save, Search, Sparkles, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { NAV_PAGES, resolveHomepage, resolveNavigation, resolveSeo } from "@/lib/site-config";
import { AdminPage } from "../components/admin-page";
import { addNavItemAction, deleteNavItemAction, moveNavItemAction, setPrimaryDomainAction, updateHomepageConfigAction, updateNavItemAction, updateSeoConfigAction, updateSettingsAction } from "./actions";

const SAVED_HINTS: Record<string, string> = { "1": "设置已保存，新的品牌配置将在下次发布时应用。", nav: "导航设置已保存，公开站导航将立即按新配置渲染。", home: "首页模块配置已保存。", seo: "SEO 默认值已保存，用于未单独设置描述的页面。", domain: "主域名已更新，公开站将优先按新主域名解析。" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await requirePermission("tenant:manage");
  const tenant = await getDb().tenant.findUniqueOrThrow({
    where: { id: session.tenantId },
    select: { name: true, shortName: true, description: true, email: true, phone: true, address: true, primaryColor: true, secondaryColor: true, publicDownloads: true, aiEnabled: true, navigationConfig: true, homepageConfig: true, seoConfig: true, domains: { orderBy: { createdAt: "asc" } } },
  });
  const nav = resolveNavigation(tenant.navigationConfig);
  const home = resolveHomepage(tenant.homepageConfig);
  const seo = resolveSeo(tenant.seoConfig);
  const state = await searchParams;
  const hint = state.saved ? (SAVED_HINTS[state.saved] ?? SAVED_HINTS["1"]) : null;
  const errors: Record<string, string> = { invalid: "提交内容不完整，请检查邮箱和颜色格式。", nav: "导航项格式不正确：标题必填、链接仅允许站内路径或 http(s) 外链。", home: "首页模块配置格式不正确。", seo: "SEO 配置格式不正确或超出长度限制。", domain: "只能把本企业已验证的域名设为主域名。" };
  return <AdminPage title="企业与网站设置" eyebrow="TENANT CONFIGURATION" tenant={tenant.name}>
    {hint && <div className="save-notice"><CheckCircle2/>{hint}</div>}{state.error && <div className="form-error">{errors[state.error] ?? errors.invalid}</div>}
    <form action={updateSettingsAction} className="settings-form"><section className="form-card"><div className="form-card-title"><div><h2>基础资料</h2><p>用于官网、页脚、询盘通知和 SEO 默认信息。</p></div><span>01</span></div><div className="form-grid"><label>企业全称<input name="name" defaultValue={tenant.name} required/></label><label>企业简称<input name="shortName" defaultValue={tenant.shortName ?? ""}/></label><label className="wide">企业简介<textarea name="description" defaultValue={tenant.description ?? ""} rows={4}/></label><label>公开邮箱<input name="email" type="email" defaultValue={tenant.email ?? ""}/></label><label>联系电话<input name="phone" defaultValue={tenant.phone ?? ""}/></label><label className="wide">联系地址<input name="address" defaultValue={tenant.address ?? ""}/></label></div></section>
      <section className="form-card"><div className="form-card-title"><div><h2>品牌外观</h2><p>首套模板以主色作为灯光强调，以辅助色承载深色区域。</p></div><Palette/></div><div className="color-grid"><label><span style={{background:tenant.primaryColor}}/><div>主品牌色<small>按钮、状态与光线强调</small></div><input name="primaryColor" defaultValue={tenant.primaryColor} pattern="#[0-9A-Fa-f]{6}"/></label><label><span style={{background:tenant.secondaryColor}}/><div>辅助色<small>导航、页脚与深色背景</small></div><input name="secondaryColor" defaultValue={tenant.secondaryColor} pattern="#[0-9A-Fa-f]{6}"/></label></div></section>
      <section className="form-card compact"><div className="setting-toggle"><Download/><div><b>公开资料免登录下载</b><p>开启后，标记为“公开”的 PDF、IES、LDT 与 CAD 可直接下载；内部资料始终需要权限。</p></div><label className="switch"><input name="publicDownloads" type="checkbox" defaultChecked={tenant.publicDownloads}/><span/></label></div><div className="setting-toggle"><Sparkles/><div><b>AI 一键翻译</b><p>开启后，产品/案例/新闻编辑页提供「一键翻译英文」（DeepSeek 按量计费，需配置 DEEPSEEK_API_KEY）。</p></div><label className="switch"><input name="aiEnabled" type="checkbox" defaultChecked={tenant.aiEnabled}/><span/></label></div><div className="setting-toggle disabled"><Languages/><div><b>简体中文 + English</b><p>两种语言独立维护、预览和发布，缺失内容不会自动替代。</p></div><em>已启用</em></div></section>
      <div className="sticky-save"><p>保存不会直接修改已发布页面，需通过发布流程更新官网。</p><button><Save/>保存设置</button></div>
    </form>

    <section className="form-card nav-editor"><div className="form-card-title"><div><h2>导航设置</h2><p>调整公开站顶部导航的顺序、名称与显隐；可添加站内页面或自定义链接。</p></div><Menu/></div>
      <div className="nav-item-list">
        {nav.map((item, index) => <form key={item.id} action={updateNavItemAction.bind(null, item.id)} className="nav-item-row">
          <span className="nav-order">0{index + 1}</span>
          <div className="nav-item-fields">
            <label>中文名称<input name="labelZh" defaultValue={item.labelZh} required maxLength={20}/></label>
            <label>English label<input name="labelEn" defaultValue={item.labelEn} required maxLength={40}/></label>
            {item.type === "page" ? <em className="nav-type-page">{NAV_PAGES.find((p) => p === item.page) ?? "?"}</em> : <label className="nav-href">链接地址<input name="href" defaultValue={item.href ?? ""} placeholder="https://…" maxLength={300}/></label>}
            <input type="hidden" name="type" value={item.type}/>
            {item.type === "page" && <input type="hidden" name="page" value={item.page ?? ""}/>}
            <label className="switch small"><input name="enabled" type="checkbox" defaultChecked={item.enabled}/><span/></label>
          </div>
          <div className="nav-item-actions">
            <button formAction={moveNavItemAction.bind(null, item.id, "up")} disabled={index === 0} title="上移"><ChevronUp/></button>
            <button formAction={moveNavItemAction.bind(null, item.id, "down")} disabled={index === nav.length - 1} title="下移"><ChevronDown/></button>
            <button formAction={deleteNavItemAction.bind(null, item.id)} className="danger" title="删除"><Trash2/></button>
            <button className="save"><Save/>保存</button>
          </div>
        </form>)}
      </div>
      <form action={addNavItemAction} className="nav-add-row">
        <select name="type"><option value="page">站内页面</option><option value="link">自定义链接</option></select>
        <select name="page">{NAV_PAGES.map((p) => <option value={p} key={p}>{p}</option>)}</select>
        <label className="nav-href">链接地址（选“自定义链接”时生效）<input name="href" placeholder="https://…" maxLength={300}/></label>
        <label>中文名称<input name="labelZh" required maxLength={20}/></label>
        <label>English label<input name="labelEn" required maxLength={40}/></label>
        <button><Plus/>添加导航项</button>
      </form>
    </section>

    <section className="form-card"><div className="form-card-title"><div><h2>首页模块</h2><p>控制首页三大模块的显隐，并可为 Hero 区块定制标题与简介（留空使用默认文案）。</p></div><LayoutTemplate/></div>
      <form action={updateHomepageConfigAction}>
        <div className="module-switches">
          <label className="setting-toggle"><input type="hidden" name="hero" value="off"/><input type="checkbox" name="hero" defaultChecked={home.hero}/><div><b>Hero 首屏</b><p>企业口号与光线视觉主体。</p></div><span className="switch"><i/></span></label>
          <label className="setting-toggle"><input type="hidden" name="products" value="off"/><input type="checkbox" name="products" defaultChecked={home.products}/><div><b>产品展示</b><p>最新发布的三款产品卡片。</p></div><span className="switch"><i/></span></label>
          <label className="setting-toggle"><input type="hidden" name="capability" value="off"/><input type="checkbox" name="capability" defaultChecked={home.capability}/><div><b>能力摘要</b><p>结构化参数与资料下载卖点。</p></div><span className="switch"><i/></span></label>
        </div>
        <div className="form-grid hero-copy-grid">
          <label>Hero 标题（中文）<input name="heroTitleZh" defaultValue={home.heroTitleZh ?? ""} placeholder="让光，成为" maxLength={60}/></label>
          <label>Hero 标题（英文）<input name="heroTitleEn" defaultValue={home.heroTitleEn ?? ""} placeholder="Let light become" maxLength={80}/></label>
          <label className="wide">Hero 简介（中文）<input name="heroIntroZh" defaultValue={home.heroIntroZh ?? ""} maxLength={200}/></label>
          <label className="wide">Hero 简介（英文）<input name="heroIntroEn" defaultValue={home.heroIntroEn ?? ""} maxLength={240}/></label>
        </div>
        <div className="sticky-save"><p>首页模块按语言渲染时，缺失的定制文案自动回退到默认文案。</p><button><Save/>保存首页配置</button></div>
      </form>
    </section>

    <section className="form-card"><div className="form-card-title"><div><h2>SEO 默认值</h2><p>站点级标题、描述与关键词；未单独设置元数据的页面使用这些默认值。</p></div><Search/></div>
      <form action={updateSeoConfigAction}>
        <div className="form-grid">
          <label className="wide">默认站点标题<input name="defaultTitle" defaultValue={seo.defaultTitle ?? ""} placeholder={tenant.name} maxLength={120}/></label>
          <label className="wide">默认描述（中文）<textarea name="defaultDescriptionZh" defaultValue={seo.defaultDescriptionZh ?? ""} rows={2} maxLength={300}/></label>
          <label className="wide">Default description (EN)<textarea name="defaultDescriptionEn" defaultValue={seo.defaultDescriptionEn ?? ""} rows={2} maxLength={300}/></label>
          <label>关键词（中文）<input name="keywordsZh" defaultValue={seo.keywordsZh ?? ""} placeholder="LED照明, 户外灯具" maxLength={200}/></label>
          <label>Keywords (EN)<input name="keywordsEn" defaultValue={seo.keywordsEn ?? ""} placeholder="LED lighting, outdoor luminaires" maxLength={200}/></label>
        </div>
        <div className="sticky-save"><p>留空字段回退到企业名称与企业简介。</p><button><Save/>保存 SEO 配置</button></div>
      </form>
    </section>

    <section className="form-card"><div className="form-card-title"><div><h2>域名管理</h2><p>查看已绑定域名并指定主域名；新增域名与验证由平台在开通流程中完成。</p></div><Globe/></div>
      <div className="domain-list">
        {tenant.domains.map((d) => <div key={d.id} className="domain-row">
          <div><b>{d.hostname}</b><small>{d.isVerified ? "已验证" : "待验证"}{d.isPrimary ? " · 主域名" : ""}</small></div>
          {d.isVerified && !d.isPrimary ? <form action={setPrimaryDomainAction.bind(null, d.id)}><button className="primary-action secondary">设为主域名</button></form> : <em>{d.isPrimary ? "当前主域名" : "验证后可设为主域名"}</em>}
        </div>)}
        {tenant.domains.length === 0 && <p className="asset-empty">尚未绑定域名，请联系平台开通。</p>}
      </div>
    </section>
  </AdminPage>;
}
