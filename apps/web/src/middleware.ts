import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith("/api/public"),
  );
  const hasSession = request.cookies.has("dior_session");

  if (!isPublic && !hasSession && !pathname.startsWith("/_next")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/users" || pathname.startsWith("/users/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/control${pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
