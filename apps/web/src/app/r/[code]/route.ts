import { NextRequest, NextResponse } from "next/server";
import { normalizeReferralCode } from "@dior/shared";
import { captureReferralOnResponse } from "@/lib/referral-cookie-response";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { code: raw } = await context.params;
  const code = normalizeReferralCode(raw);

  const registerUrl = new URL("/register", request.url);
  if (code) registerUrl.searchParams.set("ref", code);

  const response = NextResponse.redirect(registerUrl);
  return captureReferralOnResponse(request, response, code);
}
