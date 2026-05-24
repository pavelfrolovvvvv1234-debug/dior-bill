import { isLocaleId, type LocaleId } from "./index";

export const LOCALE_COOKIE = "dior-locale";

export function setLocaleCookie(locale: LocaleId) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

export function parseLocaleCookie(cookieHeader: string | undefined): LocaleId | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[1]?.trim();
  return value && isLocaleId(value) ? value : undefined;
}
