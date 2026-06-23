/** Cloudflare Turnstile site key for the registration widget (public). */
export function getTurnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!key) return null;
  // Local dev: skip widget unless explicitly enabled (production always uses Turnstile).
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_TURNSTILE_IN_DEV !== "true"
  ) {
    return null;
  }
  return key;
}

export function isTurnstileEnabled(): boolean {
  return !!getTurnstileSiteKey();
}
