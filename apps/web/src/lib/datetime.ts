import type { LocaleId } from "./i18n";

const INTL_LOCALES: Record<LocaleId, string> = {
  en: "en-US",
  ru: "ru-RU",
  zh: "zh-CN",
  es: "es-ES",
};

export type DateTimeMode = "date" | "datetime" | "time";

export function resolveIntlLocale(locale?: string): string {
  if (locale && locale in INTL_LOCALES) {
    return INTL_LOCALES[locale as LocaleId];
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
}

export function formatLocalDateTime(
  date: Date | string,
  options?: { locale?: string; mode?: DateTimeMode },
): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  const intlLocale = resolveIntlLocale(options?.locale);
  const mode = options?.mode ?? "datetime";

  const formatOpts: Intl.DateTimeFormatOptions =
    mode === "date"
      ? { month: "short", day: "numeric", year: "numeric" }
      : mode === "time"
        ? { hour: "numeric", minute: "2-digit", second: "2-digit" }
        : {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          };

  return new Intl.DateTimeFormat(intlLocale, formatOpts).format(d);
}
