import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session-edge";
import { captureReferralOnResponse } from "@/lib/referral-cookie-response";

function isPublicPath(pathname: string) {
  if (pathname === "/login" || pathname === "/register" || pathname === "/") return true;
  if (pathname.startsWith("/api/auth/clear-session")) return true;
  if (pathname.startsWith("/r/")) return true;
  if (pathname.startsWith("/api/public")) return true;
  if (pathname.startsWith("/api/referral/")) return true;
  return false;
}

function withSessionCookieCleared(response: NextResponse) {
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const hasValidSession = !!session;

  if (token && !hasValidSession) {
    if (!isPublic && !pathname.startsWith("/_next")) {
      const loginUrl = new URL("/login", request.url);
      const ref = request.nextUrl.searchParams.get("ref");
      if (ref) loginUrl.searchParams.set("ref", ref);
      const response = withSessionCookieCleared(NextResponse.redirect(loginUrl));
      return captureReferralOnResponse(request, response);
    }
    const response = withSessionCookieCleared(NextResponse.next());
    return captureReferralOnResponse(request, response);
  }

  if (!isPublic && !hasValidSession && !pathname.startsWith("/_next")) {
    const loginUrl = new URL("/login", request.url);
    const ref = request.nextUrl.searchParams.get("ref");
    if (ref) loginUrl.searchParams.set("ref", ref);
    const response = NextResponse.redirect(loginUrl);
    return captureReferralOnResponse(request, response);
  }

  if (hasValidSession && (pathname === "/login" || pathname === "/register")) {
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
