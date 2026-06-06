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

export type ControlNavItem = {
  path: string;
  labelKey: string;
  icon: LucideIcon;
  permission?: ControlPermission;
};

const BASE = "/control";

/** Staff sidebar on customer shell — same-origin /control routes */
export const CONTROL_NAV_ITEMS: ControlNavItem[] = [
  { path: "", labelKey: "controlNav.dashboard", icon: LayoutDashboard },
  { path: "/users", labelKey: "controlNav.users", icon: Users, permission: "users.read" },
  { path: "/services", labelKey: "controlNav.services", icon: Layers, permission: "services.read" },
  { path: "/payments", labelKey: "controlNav.payments", icon: Wallet, permission: "payments.read" },
  { path: "/billing", labelKey: "controlNav.billing", icon: CreditCard, permission: "billing.read" },
  { path: "/support", labelKey: "controlNav.support", icon: LifeBuoy, permission: "support.read" },
  { path: "/promo", labelKey: "controlNav.promo", icon: Tag, permission: "promo.read" },
  { path: "/referrals", labelKey: "controlNav.referrals", icon: Share2, permission: "referrals.read" },
  { path: "/security", labelKey: "controlNav.security", icon: Shield, permission: "security.read" },
  { path: "/audit", labelKey: "controlNav.audit", icon: ScrollText, permission: "audit.read" },
  { path: "/analytics", labelKey: "controlNav.analytics", icon: BarChart3, permission: "analytics.read" },
  {
    path: "/notifications",
    labelKey: "controlNav.notifications",
    icon: Megaphone,
    permission: "notifications.write",
  },
  {
    path: "/statistics",
    labelKey: "controlNav.statistics",
    icon: PieChart,
    permission: "analytics.read",
  },
  { path: "/settings", labelKey: "controlNav.settings", icon: Settings },
];

export function getControlNavForRole(role: string): ControlNavItem[] {
  const r = role as UserRole;
  return CONTROL_NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(r, item.permission),
  );
}

export function controlNavHref(path: string): string {
  return path ? `${BASE}${path}` : BASE;
}
