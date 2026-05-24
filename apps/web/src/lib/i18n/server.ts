import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocaleCookie } from "./cookie";
import { translate, type LocaleId } from "./index";

export async function getServerLocale(fallback: LocaleId = "en"): Promise<LocaleId> {
  const store = await cookies();
  const fromCookie = parseLocaleCookie(store.get(LOCALE_COOKIE)?.value);
  return fromCookie ?? fallback;
}

export async function getServerT(fallback: LocaleId = "en") {
  const locale = await getServerLocale(fallback);
  return (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
}
