import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Layers,
  Wallet,
  Tag,
  Share2,
  LifeBuoy,
  ScrollText,
  Megaphone,
  PieChart,
  Settings,
} from "lucide-react";
import { hasPermission, type ControlPermission, type UserRole } from "@dior/shared";

export type ControlNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: ControlPermission;
};

const BASE = "/control";

export const CONTROL_NAV: ControlNavItem[] = [
  { href: BASE, label: "Dashboard", icon: LayoutDashboard },
  { href: `${BASE}/users`, label: "Users", icon: Users, permission: "users.read" },
  { href: `${BASE}/services`, label: "Services", icon: Layers, permission: "services.read" },
  { href: `${BASE}/billing`, label: "Billing", icon: Wallet, permission: "billing.read" },
  { href: `${BASE}/support`, label: "Tickets", icon: LifeBuoy, permission: "support.read" },
  { href: `${BASE}/promo`, label: "Promo codes", icon: Tag, permission: "promo.read" },
  { href: `${BASE}/referrals`, label: "Referrals", icon: Share2, permission: "referrals.read" },
  { href: `${BASE}/audit`, label: "Logs", icon: ScrollText, permission: "audit.read" },
  {
    href: `${BASE}/notifications`,
    label: "Notifications",
    icon: Megaphone,
    permission: "notifications.write",
  },
  {
    href: `${BASE}/statistics`,
    label: "Statistics",
    icon: PieChart,
    permission: "analytics.read",
  },
  { href: `${BASE}/settings`, label: "Settings", icon: Settings },
];

export function getControlNavForRole(role: string): ControlNavItem[] {
  const r = role as UserRole;
  return CONTROL_NAV.filter((item) => !item.permission || hasPermission(r, item.permission));
}

export function isNavActive(pathname: string, href: string) {
  if (href === BASE) return pathname === BASE;
  return pathname === href || pathname.startsWith(`${href}/`);
}
