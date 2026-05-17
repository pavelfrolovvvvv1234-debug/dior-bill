import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Layers,
  CreditCard,
  Wallet,
  Tag,
  Share2,
  Server,
  LifeBuoy,
  Shield,
  ScrollText,
  BarChart3,
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
  { href: `${BASE}/payments`, label: "Payments", icon: Wallet, permission: "payments.read" },
  { href: `${BASE}/billing`, label: "Billing", icon: CreditCard, permission: "billing.read" },
  { href: `${BASE}/support`, label: "Tickets", icon: LifeBuoy, permission: "support.read" },
  {
    href: `${BASE}/infrastructure`,
    label: "Infrastructure",
    icon: Server,
    permission: "infrastructure.read",
  },
  { href: `${BASE}/promo`, label: "Promo codes", icon: Tag, permission: "promo.read" },
  { href: `${BASE}/referrals`, label: "Referrals", icon: Share2, permission: "referrals.read" },
  { href: `${BASE}/security`, label: "Security", icon: Shield, permission: "security.read" },
  { href: `${BASE}/audit`, label: "Audit log", icon: ScrollText, permission: "audit.read" },
  { href: `${BASE}/analytics`, label: "Analytics", icon: BarChart3, permission: "analytics.read" },
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
