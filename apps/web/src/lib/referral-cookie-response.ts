import type { NextRequest, NextResponse } from "next/server";
import {
  normalizeReferralCode,
  REFERRAL_COOKIE_MAX_AGE_SEC,
  REFERRAL_COOKIE_NAME,
} from "@dior/shared";

function referralCookieOptions(maxAge = REFERRAL_COOKIE_MAX_AGE_SEC) {
  return {
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    domain: process.env.REFERRAL_COOKIE_DOMAIN || undefined,
  };
}

export function captureReferralOnResponse(
  request: NextRequest,
  response: NextResponse,
  explicitCode?: string | null,
): NextResponse {
  const code = normalizeReferralCode(explicitCode ?? request.nextUrl.searchParams.get("ref"));
  if (!code) return response;

  response.cookies.set(REFERRAL_COOKIE_NAME, code, referralCookieOptions());
  return response;
}
