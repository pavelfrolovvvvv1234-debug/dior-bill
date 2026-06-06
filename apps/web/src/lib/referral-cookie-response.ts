import type { NextRequest, NextResponse } from "next/server";
import { normalizeReferralCode, REFERRAL_COOKIE_NAME } from "@dior/shared";
import { referralCookieOptions } from "@/lib/referral";

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
