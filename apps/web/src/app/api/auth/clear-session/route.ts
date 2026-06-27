import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/session-edge";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  const url = new URL(request.url);
  const after = url.searchParams.get("redirect");
  const login = new URL("/login", request.url);
  if (after?.startsWith("/")) {
    login.searchParams.set("redirect", after);
  }

  return NextResponse.redirect(login);
}
