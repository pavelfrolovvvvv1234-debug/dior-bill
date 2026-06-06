export const REFERRAL_COOKIE_NAME = "dior_ref";
export const REFERRAL_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_RE = new RegExp(`^[${REFERRAL_CODE_CHARS}]{8}$`);

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!REFERRAL_CODE_RE.test(code)) return null;
  return code;
}

export function buildReferralLink(code: string, marketingUrl = "https://dior.host"): string {
  const base = marketingUrl.replace(/\/$/, "");
  return `${base}/?ref=${code}`;
}

export function buildReferralCaptureUrl(code: string, appUrl = "http://localhost:3000"): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/r/${code}`;
}
