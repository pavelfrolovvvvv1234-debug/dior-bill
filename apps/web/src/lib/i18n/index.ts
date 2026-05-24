import en from "./locales/en.json";
import ru from "./locales/ru.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";

export const LOCALES = [
  { id: "en", label: "English", native: "English" },
  { id: "ru", label: "Russian", native: "Русский" },
  { id: "zh", label: "Chinese", native: "中文" },
  { id: "es", label: "Spanish", native: "Español" },
] as const;

export type LocaleId = (typeof LOCALES)[number]["id"];

const maps: Record<LocaleId, Record<string, unknown>> = { en, ru, zh, es };

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(
  locale: LocaleId,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let text =
    getNested(maps[locale] as Record<string, unknown>, key) ??
    getNested(en as Record<string, unknown>, key) ??
    key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function isLocaleId(value: string): value is LocaleId {
  return value in maps;
}
