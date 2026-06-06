import { cookies } from "next/headers";
import {
  REFERRAL_COOKIE_MAX_AGE_SEC,
  REFERRAL_COOKIE_NAME,
  normalizeReferralCode,
} from "@dior/shared";

export function referralCookieOptions(maxAge = REFERRAL_COOKIE_MAX_AGE_SEC) {
  return {
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    domain: process.env.REFERRAL_COOKIE_DOMAIN || undefined,
  };
}

export async function getReferralCodeFromCookie(): Promise<string | null> {
  const store = await cookies();
  return normalizeReferralCode(store.get(REFERRAL_COOKIE_NAME)?.value);
}

export async function clearReferralCookie() {
  const store = await cookies();
  store.set(REFERRAL_COOKIE_NAME, "", { ...referralCookieOptions(0) });
}

export async function resolveRegistrationReferralCode(
  fromForm?: string | null,
): Promise<string | undefined> {
  const fromCookie = await getReferralCodeFromCookie();
  return normalizeReferralCode(fromForm) ?? fromCookie ?? undefined;
}
