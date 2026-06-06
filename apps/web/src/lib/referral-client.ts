import { normalizeReferralCode, REFERRAL_COOKIE_NAME } from "@dior/shared";

export function readReferralCookieClient(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${REFERRAL_COOKIE_NAME}=`;
  const entry = document.cookie.split("; ").find((row) => row.startsWith(prefix));
  if (!entry) return null;
  return normalizeReferralCode(decodeURIComponent(entry.slice(prefix.length)));
}
