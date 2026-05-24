"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { StatusIndicator } from "@/components/ui/enterprise/status-indicator";
import { FastLink } from "@/components/ui/fast-link";
import { APP_NAME } from "@dior/shared";
import { BILLING_PREFETCH_PATHS, MAIN_NAV, NAV_PREFETCH_PATHS, isNavItemActive } from "@/lib/navigation";
import { controlNavHref, getControlNavForRole } from "@/lib/control-navigation";
import { isStaffRole } from "@/lib/staff";
import { PromoNavTrigger } from "@/components/layout/promo-nav-trigger";
import { useI18n } from "@/lib/i18n/store";

type SidebarProps = {
  userRole?: string;
};

export function Sidebar({ userRole = "USER" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const staff = isStaffRole(userRole);
  const controlNav = useMemo(() => getControlNavForRole(userRole), [userRole]);
  const homeHref = staff ? "/control" : "/dashboard";

  useEffect(() => {
    if (staff) return;
    for (const href of NAV_PREFETCH_PATHS) {
      router.prefetch(href);
    }
    router.prefetch("/plans?tab=bulletproof-vps");
    router.prefetch("/plans?tab=bulletproof-domains");
    for (const href of BILLING_PREFETCH_PATHS) {
      router.prefetch(href);
    }
  }, [router, staff]);

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-3.5 z-50 rounded-md border border-border bg-card p-2 lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label={t("sidebar.openMenu")}
      >
        <Menu className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        />
      )}

      <aside
        className={cn(
          "pointer-events-auto fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border bg-surface glass-nav",
          collapsed ? "w-[68px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-[transform,width] duration-150 ease-out",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          <a
            href={homeHref}
            className={cn(
              "truncate font-semibold tracking-tight text-foreground transition-premium hover:text-foreground/90",
              collapsed ? "mx-auto text-xs" : "px-1 text-sm",
            )}
          >
            {collapsed ? "DC" : APP_NAME}
          </a>
          <button
            type="button"
            className="hidden rounded-md p-1.5 text-muted-foreground transition-premium hover:bg-white/5 hover:text-foreground lg:flex"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            <ChevronLeft
              className={cn("h-4 w-4 transition-transform duration-150", collapsed && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>
        </div>

        <nav className="scroll-dior flex-1 space-y-0.5 overflow-y-auto p-2">
          {staff
            ? controlNav.map((item) => {
                const Icon = item.icon;
                const href = controlNavHref(item.path);
                const active =
                  pathname === href || (href !== "/control" && pathname.startsWith(`${href}/`));
                return (
                  <FastLink
                    key={item.path || "dashboard"}
                    href={href}
                    prefetch
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-premium",
                      active
                        ? "nav-item-active"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    {!collapsed && <span>{t(item.labelKey)}</span>}
                  </FastLink>
                );
              })
            : MAIN_NAV.map((item) => {
                const active = isNavItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <div key={item.href}>
                    <FastLink
                      href={item.href}
                      prefetch
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-premium",
                        active
                          ? "nav-item-active"
                          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span>{t(item.labelKey)}</span>}
                    </FastLink>
                    {item.href === "/billing" && (
                      <PromoNavTrigger
                        collapsed={collapsed}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    )}
                  </div>
                );
              })}
        </nav>

        <div className="border-t border-border p-3">
          {!collapsed && (
            <p className="px-1 text-xs text-muted-foreground">
              {staff ? t("sidebar.controlPlane") : t("sidebar.status")}
            </p>
          )}
          <div className={cn("mt-2", collapsed && "flex justify-center")}>
            {staff ? (
              !collapsed && (
                <p className="px-1 text-xs text-muted-foreground">
                  <FastLink href="/control" className="text-primary hover:underline">
                    {t("controlNav.openPanel")}
                  </FastLink>
                </p>
              )
            ) : (
              <StatusIndicator
                status="operational"
                label={t("sidebar.allSystemsOperational")}
                showLabel={!collapsed}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
