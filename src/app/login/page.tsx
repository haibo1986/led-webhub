import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { loginAction } from "./actions";

const errors: Record<string, string> = { invalid: "请输入有效邮箱和至少 8 位密码。", credentials: "邮箱、密码或企业状态不正确。", session: "会话已失效，请重新登录。", rate_limited: "尝试次数过多，请 15 分钟后再试。" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="login-page">
    <section className="login-visual"><Link href="/" className="login-back"><ArrowLeft size={16}/>返回企业官网</Link><div className="login-light"/><div className="login-message"><p>LED WEBHUB · ENTERPRISE</p><h1>让专业资料，<br/>持续产生价值。</h1><span>一个后台，管理双语官网、产品 SKU、技术文件与客户询盘。</span></div><footer>多租户数据隔离 <i/> 服务端权限校验 <i/> 全程审计</footer></section>
    <section className="login-form-wrap"><div className="login-form-box"><div className="admin-brand login-brand"><span className="brand-mark"><span/></span><div><b>LED WebHub</b><small>企业内容中枢</small></div></div><div className="login-title"><p>企业后台</p><h2>登录工作空间</h2><span>使用企业管理员或获授权编辑账号登录。</span></div>
      {error && <div className="form-error" role="alert">{errors[error] ?? errors.credentials}</div>}
      <form action={loginAction} className="auth-form"><label>工作邮箱<input name="email" type="email" autoComplete="email" placeholder="name@company.com" required/></label><label>密码<input name="password" type="password" autoComplete="current-password" placeholder="至少 8 位" required minLength={8}/></label><button>安全登录 <ArrowRight size={17}/></button></form>
      <p className="login-security"><ShieldCheck size={15}/>账号停用、租户停用或权限撤销后，会话立即失效。</p>
    </div></section>
  </main>;
}
