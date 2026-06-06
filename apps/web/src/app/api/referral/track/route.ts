import { NextRequest, NextResponse } from "next/server";
import { normalizeReferralCode } from "@dior/shared";
import { captureReferralOnResponse } from "@/lib/referral-cookie-response";

function safeRedirectUrl(request: NextRequest, nextParam: string | null): URL {
  const fallback = new URL("/register", request.url);

  if (!nextParam) return fallback;

  try {
    const target = new URL(nextParam);
    const allowedHosts = new Set([
      "dior.host",
      "www.dior.host",
      "my.dior.host",
      "localhost",
      "127.0.0.1",
    ]);
    if (!allowedHosts.has(target.hostname)) return fallback;
    return target;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get("ref"));
  const target = safeRedirectUrl(request, request.nextUrl.searchParams.get("next"));
  target.searchParams.delete("ref");

  const response = NextResponse.redirect(target);
  return captureReferralOnResponse(request, response, code);
}
