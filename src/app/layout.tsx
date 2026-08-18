import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LED WebHub · 照明企业数字展厅", template: "%s | LED WebHub" },
  description: "面向 LED 照明企业的官网、产品资料与询盘管理平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 语言由 proxy.ts 按 URL 段落写入 x-locale 头，据此设置 <html lang>
  const lang = (await headers()).get("x-locale") === "en" ? "en" : "zh-CN";
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
