import { ADMIN_ROLES } from "@dior/shared";

export function isStaffRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export function getAdminPanelUrl(path = "/"): string {
  const base = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001").replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Where to send the user right after login/register */
export function getPostAuthDestination(role: string): string {
  if (isStaffRole(role)) return getAdminPanelUrl("/");
  return "/dashboard";
}
