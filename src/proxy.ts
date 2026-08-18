import { NextResponse, type NextRequest } from "next/server";

// 语言与索引治理：把 URL 中的语言段落落到 x-locale 头（根 layout 据此设置 <html lang>），
// 并写入 locale cookie；后台与登录页、API 一律 noindex。
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const locale = isEn ? "en" : "zh-CN";
  const headers = new Headers(request.headers);
  headers.set("x-locale", locale);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-locale", locale);
  response.cookies.set("led_webhub_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (pathname.startsWith("/dashboard") || pathname === "/login" || pathname.startsWith("/api/")) response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
