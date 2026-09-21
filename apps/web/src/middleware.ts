import { NextRequest, NextResponse } from "next/server";

// PRD 8.22절: middleware.ts는 Refresh 쿠키 존재 여부만 가볍게 확인하는 1차 UX 방어일 뿐,
// 보안 경계가 아니다 — 최종 인가는 항상 NestJS가 각 API 호출 시점에 재검증한다.
const PROTECTED_PREFIXES = ["/mypage", "/admin"];
const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Secure-refresh_token" : "refresh_token";

export function middleware(req: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const hasRefreshCookie = req.cookies.has(COOKIE_NAME);
  if (!hasRefreshCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/mypage/:path*", "/admin/:path*"],
};
