"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusIndicator } from "@/components/ui/enterprise/status-indicator";
import { FastLink } from "@/components/ui/fast-link";
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
  const initial = (user.email ?? "U")[0]?.toUpperCase();

  useEffect(() => {
    for (const path of PREFETCH) router.prefetch(path);
  }, [router]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 pl-14 lg:gap-4 lg:px-6 lg:pl-6">
      <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:ml-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
        />
        <Input
          placeholder={t("topbar.searchPlaceholder")}
          className="h-9 pl-9 text-sm"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <StatusIndicator status="operational" showLabel={false} className="hidden sm:flex" />
        <Button variant="default" size="sm" className="h-8 gap-1.5" asChild>
          <FastLink href="/billing/topup">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">{t("topbar.topUp")}</span>
          </FastLink>
        </Button>
        <NotificationBell />
        <FastLink
          href="/settings"
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
