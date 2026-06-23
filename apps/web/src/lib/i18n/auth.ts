import { translate } from "./index";

/** Auth pages are always English, regardless of dashboard locale. */
export function authT(key: string, vars?: Record<string, string | number>): string {
  return translate("en", key, vars);
}
