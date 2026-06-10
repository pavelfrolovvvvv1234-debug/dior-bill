/** Cloudflare Turnstile site key for the registration widget (public). */
export function getTurnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key || null;
}

export function isTurnstileEnabled(): boolean {
  return !!getTurnstileSiteKey();
}
