import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Layers,
  CreditCard,
  Wallet,
  Tag,
  Share2,
  LifeBuoy,
  Shield,
  ScrollText,
  BarChart3,
  Megaphone,
  PieChart,
  Settings,
} from "lucide-react";
import { hasPermission, type ControlPermission, type UserRole } from "@dior/shared";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: ControlPermission;
};

export const CONTROL_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users, permission: "users.read" },
  { href: "/services", label: "Services", icon: Layers, permission: "services.read" },
  { href: "/payments", label: "Payments", icon: Wallet, permission: "payments.read" },
  { href: "/billing", label: "Billing", icon: CreditCard, permission: "billing.read" },
  { href: "/support", label: "Tickets", icon: LifeBuoy, permission: "support.read" },
  { href: "/promo", label: "Promo codes", icon: Tag, permission: "promo.read" },
  { href: "/referrals", label: "Referrals", icon: Share2, permission: "referrals.read" },
  { href: "/security", label: "Security", icon: Shield, permission: "security.read" },
  { href: "/audit", label: "Audit log", icon: ScrollText, permission: "audit.read" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.read" },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Megaphone,
    permission: "notifications.write",
  },
  {
    href: "/statistics",
    label: "Statistics",
    icon: PieChart,
    permission: "analytics.read",
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function getControlNavForRole(role: string): NavItem[] {
  const r = role as UserRole;
  return CONTROL_NAV.filter((item) => !item.permission || hasPermission(r, item.permission));
}

export const CONTROL_PREFETCH = CONTROL_NAV.map((n) => n.href);

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
