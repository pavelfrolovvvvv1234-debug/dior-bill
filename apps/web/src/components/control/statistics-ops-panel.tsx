"use client";

import Link from "next/link";
import type { PurchasePeriodStats } from "@dior/backend";
import { controlPath } from "@/lib/control-paths";
import { useI18n } from "@/lib/i18n/store";
import { AlertTriangle, Clock, LifeBuoy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type OpsItem = {
  labelKey: string;
  count: number;
  href: string;
  icon: typeof Wallet;
  tone: "warning" | "info" | "neutral";
};

function buildOpsItems(stats: PurchasePeriodStats): OpsItem[] {
  return [
    {
      labelKey: "controlStatistics.attention.manualReview",
      count: stats.manualReviewTopUps,
      href: controlPath("/billing/top-ups?status=MANUAL_REVIEW"),
      icon: AlertTriangle,
      tone: "warning",
    },
    {
      labelKey: "controlStatistics.attention.pendingTopUps",
      count: stats.pendingTopUps,
      href: controlPath("/billing/top-ups?status=PENDING"),
      icon: Clock,
      tone: "info",
    },
    {
      labelKey: "controlStatistics.attention.failedPayments",
      count: stats.failedTopUps,
      href: controlPath("/billing/top-ups?status=FAILED"),
      icon: Wallet,
      tone: "neutral",
    },
    {
      labelKey: "controlStatistics.attention.ticketsOpened",
      count: stats.ticketsOpened,
      href: controlPath("/support"),
      icon: LifeBuoy,
      tone: "neutral",
    },
  ];
}

const toneStyles = {
  warning: "border-amber-500/20 bg-amber-500/5 text-amber-200",
  info: "border-primary/20 bg-primary/5 text-primary",
  neutral: "border-border bg-muted/20 text-foreground",
};

export function StatisticsOpsPanel({ stats }: { stats: PurchasePeriodStats }) {
  const { t } = useI18n();
  const items = buildOpsItems(stats);
  const hasAttention = items.some((i) => i.count > 0 && i.tone !== "neutral");

  return (
    <div className="space-y-3">
      {!hasAttention && (
        <p className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {t("controlStatistics.attention.empty")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.count > 0;
          return (
            <Link
              key={item.labelKey}
              href={item.href}
              className={cn(
                "group card-interactive flex items-center gap-4 rounded-xl border px-4 py-3.5",
                active ? toneStyles[item.tone] : "border-border bg-muted/20 opacity-60 hover:opacity-100",
                "hover:border-border/80 hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60",
                  active && item.tone === "warning" && "border-amber-500/30",
                  active && item.tone === "info" && "border-primary/30",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t(item.labelKey)}</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{item.count}</p>
              </div>
              <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {t("controlStatistics.attention.view")}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
