import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { captureReferralOnResponse } from "@/lib/referral-cookie-response";

function isPublicPath(pathname: string) {
  if (pathname === "/login" || pathname === "/register" || pathname === "/") return true;
  if (pathname.startsWith("/r/")) return true;
  if (pathname.startsWith("/api/public")) return true;
  if (pathname.startsWith("/api/referral/")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const hasSession = request.cookies.has("dior_session");

  if (!isPublic && !hasSession && !pathname.startsWith("/_next")) {
    const loginUrl = new URL("/login", request.url);
    const ref = request.nextUrl.searchParams.get("ref");
    if (ref) loginUrl.searchParams.set("ref", ref);
    const response = NextResponse.redirect(loginUrl);
    return captureReferralOnResponse(request, response);
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    return captureReferralOnResponse(request, response);
  }

  if (pathname === "/users" || pathname.startsWith("/users/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/control${pathname}`;
    const response = NextResponse.redirect(url);
    return captureReferralOnResponse(request, response);
  }

  const response = NextResponse.next();
  return captureReferralOnResponse(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
