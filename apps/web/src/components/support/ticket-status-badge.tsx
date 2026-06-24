"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/store";

const VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "default"> = {
  OPEN: "default",
  AWAITING_STAFF: "warning",
  AWAITING_CUSTOMER: "default",
  RESOLVED: "success",
  CLOSED: "muted",
};

export function TicketStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const key = status.toUpperCase();
  const labelKey = `support.status.${key}`;
  const label = t(labelKey);
  const variant = VARIANT[key] ?? "muted";

  return <Badge variant={variant}>{label !== labelKey ? label : status}</Badge>;
}
