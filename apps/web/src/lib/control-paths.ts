/** Base path for DIOR CONTROL inside the web app */
export const CONTROL_BASE = "/control";

export function controlPath(segment = ""): string {
  if (!segment || segment === "/") return CONTROL_BASE;
  const path = segment.startsWith("/") ? segment : `/${segment}`;
  return `${CONTROL_BASE}${path}`;
}
