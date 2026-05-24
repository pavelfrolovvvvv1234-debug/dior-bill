/** True when URL leaves the billing app (real gateway / Crypto Pay). */
export function isExternalPaymentUrl(url: string): boolean {
  try {
    const target = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    const appBase = process.env.NEXT_PUBLIC_APP_URL;
    if (appBase) {
      const app = new URL(appBase);
      if (target.origin === app.origin && target.pathname.startsWith("/billing/topup")) {
        return false;
      }
    }
    if (typeof window !== "undefined" && target.origin === window.location.origin) {
      if (target.pathname.startsWith("/billing/topup")) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function openPaymentUrl(url: string): boolean {
  if (!url) return false;
  if (isExternalPaymentUrl(url)) {
    window.location.assign(url);
    return true;
  }
  return false;
}
