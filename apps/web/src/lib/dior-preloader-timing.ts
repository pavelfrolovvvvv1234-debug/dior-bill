/** Matches dior.host home preloader (`layout` chunk): 650ms hold + 280ms fade removal. */
export const DIOR_PRELOADER_HOLD_MS = 650;
export const DIOR_PRELOADER_FADE_MS = 280;

export const AUTH_PAGE_PATHS = ["/login", "/register"] as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until client navigation leaves login/register (or timeout). */
export function waitUntilLeftAuthPages(timeoutMs = 10_000): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const isAuthPage = () =>
    AUTH_PAGE_PATHS.includes(
      window.location.pathname as (typeof AUTH_PAGE_PATHS)[number],
    );

  if (!isAuthPage()) return Promise.resolve();

  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (!isAuthPage() || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve();
      }
    }, 40);
  });
}
