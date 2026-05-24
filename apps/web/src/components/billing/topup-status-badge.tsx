"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/store";

const statusVariant: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "muted" | "outline"
> = {
  PENDING: "muted",
  PROCESSING: "default",
  PAID: "success",
  FAILED: "destructive",
  EXPIRED: "outline",
  REFUNDED: "outline",
  MANUAL_REVIEW: "warning",
};

const TOPUP_STATUS_KEYS = new Set([
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "MANUAL_REVIEW",
]);

export function TopUpStatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const label = TOPUP_STATUS_KEYS.has(status)
    ? t(`billing.status.${status}`)
    : status;

  return (
    <Badge variant={statusVariant[status] ?? "muted"} className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}
