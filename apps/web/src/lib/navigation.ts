import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Layers,
  ShoppingCart,
  CreditCard,
  Users,
  LifeBuoy,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Extra path prefixes that should mark this item active */
  match?: string[];
};

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/plans", labelKey: "nav.selectPlan", icon: ShoppingCart },
  {
    href: "/services",
    labelKey: "nav.myServices",
    icon: Layers,
    match: ["/vps"],
  },
  { href: "/billing", labelKey: "nav.billing", icon: CreditCard },
  { href: "/referrals", labelKey: "nav.affiliate", icon: Users },
  { href: "/support", labelKey: "nav.support", icon: LifeBuoy },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, match: ["/settings"] },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  if (pathname.startsWith(`${item.href}/`)) return true;
  for (const prefix of item.match ?? []) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export const NAV_PREFETCH_PATHS = MAIN_NAV.map((n) => n.href);

/** Prefetch all billing sub-routes for instant navigation from sidebar */
export const BILLING_PREFETCH_PATHS = [
  "/billing",
  "/billing/topup",
  "/billing/transactions",
] as const;
