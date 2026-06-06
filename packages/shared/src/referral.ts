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

export function buildReferralLink(code: string, marketingUrl?: string): string {
  const base = (marketingUrl ?? process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://dior.host").replace(
    /\/$/,
    "",
  );
  return `${base}/?ref=${code}`;
}

export function buildReferralCaptureUrl(code: string, appUrl?: string): string {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/r/${code}`;
}
