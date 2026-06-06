"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CommandPaletteTrigger } from "@/components/control/command-palette";
import { DashboardSearch } from "@/components/layout/dashboard-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/enterprise/status-indicator";
import { FastLink } from "@/components/ui/fast-link";
import { isStaffRole } from "@/lib/staff";
import { useI18n } from "@/lib/i18n/store";

const PREFETCH = [
  "/services",
  "/plans",
  "/settings",
  "/billing",
  "/billing/topup",
  "/billing/transactions",
];

interface TopbarProps {
  user: {
    email: string | null;
    role?: string;
  };
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const { t } = useI18n();
  const staff = isStaffRole(user.role);
  const initial = (user.email ?? "U")[0]?.toUpperCase();
  const settingsHref = staff ? "/control/settings" : "/settings";

  useEffect(() => {
    if (staff) return;
    for (const path of PREFETCH) router.prefetch(path);
  }, [router, staff]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 pl-14 backdrop-blur-sm lg:gap-4 lg:px-6 lg:pl-6">
      {staff ? <CommandPaletteTrigger /> : <DashboardSearch />}

      <div className="ml-auto flex items-center gap-2">
        {!staff && (
          <StatusIndicator status="operational" showLabel={false} className="hidden sm:flex" />
        )}
        {staff && user.role && (
          <Badge variant="muted" className="hidden sm:inline-flex">
            {user.role.replace("_", " ")}
          </Badge>
        )}
        {!staff && (
          <Button variant="default" size="sm" className="h-8 gap-1.5" asChild>
            <FastLink href="/billing/topup">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t("topbar.topUp")}</span>
            </FastLink>
          </Button>
        )}
        <NotificationBell />
        <FastLink
          href={settingsHref}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2 transition-premium hover:bg-accent"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/15 text-xs font-semibold text-primary">
            {initial}
          </span>
          <span className="hidden max-w-[180px] truncate text-xs font-medium lg:inline">
            {user.email ?? t("common.account")}
          </span>
        </FastLink>
      </div>
    </header>
  );
}
