import type { Metadata } from "next";
import { Building2, Mail, MapPin, Phone, Send } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicTenant, isSiteLocale } from "@/lib/public-site";
import { publicMetadata } from "@/lib/seo";
import { createInquiryAction } from "./actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return {};
  return publicMetadata(locale, "/contact", { "zh-CN": "联系我们", en: "Contact" });
}

export default async function ContactPage({ params, searchParams }: PageProps<"/[locale]/contact">) {
  const { locale } = await params; if (!isSiteLocale(locale)) notFound(); const state = await searchParams; const tenant = await getPublicTenant(); const zh = locale === "zh-CN"; const submit = createInquiryAction.bind(null, locale);
  return <main className="contact-page"><section className="inner-hero contact-hero"><p>CONTACT · PROJECT INQUIRY</p><h1>{zh ? "把项目带来，我们一起把光做对。" : "Bring the project. Let’s get the light right."}</h1><span>{zh ? "请提供应用场景、项目阶段与核心技术要求，我们的团队将据此回复。" : "Share the application, project stage and key requirements so our team can respond with context."}</span></section><section className="contact-layout"><aside><p>{zh ? "企业信息" : "COMPANY DETAILS"}</p><h2>{tenant.name}</h2><div><span><Building2/><b>{zh ? "企业" : "Company"}</b>{tenant.name}</span><span><MapPin/><b>{zh ? "地址" : "Address"}</b>{tenant.address ?? (zh ? "请通过表单联系我们" : "Contact us through the form")}</span><span><Phone/><b>{zh ? "电话" : "Phone"}</b>{tenant.phone ?? "—"}</span><span><Mail/><b>{zh ? "邮箱" : "Email"}</b>{tenant.email ?? "—"}</span></div></aside><form action={submit} className="inquiry-form"><div><p>{zh ? "项目询盘" : "PROJECT INQUIRY"}</p><h2>{zh ? "告诉我们你的需求" : "Tell us what you are working on"}</h2></div>{state.sent && <div className="inquiry-success">{zh ? "询盘已提交，我们会尽快与你联系。" : "Your inquiry has been received. We will contact you shortly."}</div>}{state.error === "rate_limited" && <div className="form-error">{zh ? "提交过于频繁，请一小时后再试。" : "Too many submissions. Please try again in an hour."}</div>}{state.error && state.error !== "rate_limited" && <div className="form-error">{zh ? "请检查必填项和邮箱格式。" : "Please check required fields and your email address."}</div>}<input className="form-honeypot" name="website" tabIndex={-1} autoComplete="off"/><div className="inquiry-grid"><label>{zh ? "姓名 *" : "Name *"}<input name="name" required/></label><label>{zh ? "公司" : "Company"}<input name="company"/></label><label>{zh ? "邮箱 *" : "Email *"}<input name="email" type="email" required/></label><label>{zh ? "电话" : "Phone"}<input name="phone"/></label><label className="wide">{zh ? "国家或地区" : "Country / region"}<input name="country"/></label><label className="wide">{zh ? "项目需求 *" : "Project requirements *"}<textarea name="message" rows={7} required minLength={10}/></label></div><button><span>{zh ? "提交项目询盘" : "Send project inquiry"}</span><Send/></button></form></section></main>;
}
