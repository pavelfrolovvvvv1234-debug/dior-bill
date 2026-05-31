import Link from "next/link";
import type { PurchasePeriodStats } from "@dior/backend";
import { controlPath } from "@/lib/control-paths";
import { AlertTriangle, Clock, LifeBuoy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type OpsItem = {
  label: string;
  count: number;
  href: string;
  icon: typeof Wallet;
  tone: "warning" | "info" | "neutral";
};

function buildOpsItems(stats: PurchasePeriodStats): OpsItem[] {
  return [
    {
      label: "Manual review",
      count: stats.manualReviewTopUps,
      href: controlPath("/billing/top-ups?status=MANUAL_REVIEW"),
      icon: AlertTriangle,
      tone: "warning",
    },
    {
      label: "Pending top-ups",
      count: stats.pendingTopUps,
      href: controlPath("/billing/top-ups?status=PENDING"),
      icon: Clock,
      tone: "info",
    },
    {
      label: "Failed payments",
      count: stats.failedTopUps,
      href: controlPath("/billing/top-ups?status=FAILED"),
      icon: Wallet,
      tone: "neutral",
    },
    {
      label: "Tickets opened",
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
  neutral: "border-white/8 bg-white/[0.02] text-foreground",
};

export function StatisticsOpsPanel({ stats }: { stats: PurchasePeriodStats }) {
  const items = buildOpsItems(stats);
  const hasAttention = items.some((i) => i.count > 0 && i.tone !== "neutral");

  return (
    <div className="space-y-3">
      {!hasAttention && (
        <p className="rounded-lg border border-white/6 bg-white/[0.02] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
          No items need attention in the last 30 days.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.count > 0;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "group flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all",
                active ? toneStyles[item.tone] : "border-white/6 bg-white/[0.02] opacity-60 hover:opacity-100",
                "hover:border-white/12 hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-black/20",
                  active && item.tone === "warning" && "border-amber-500/30",
                  active && item.tone === "info" && "border-primary/30",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--muted-foreground)]">{item.label}</p>
                <p className="text-xl font-semibold tabular-nums tracking-tight">{item.count}</p>
              </div>
              <span className="text-xs text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100">
                View →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
