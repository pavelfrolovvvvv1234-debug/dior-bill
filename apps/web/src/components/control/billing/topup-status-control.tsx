"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setTopUpStatusAction } from "@/app/actions/billing";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";

const TOP_UP_STATUSES = [
  "PENDING",
  "PROCESSING",
  "MANUAL_REVIEW",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
] as const;

type TopUpStatus = (typeof TOP_UP_STATUSES)[number];

const STATUS_LABELS: Record<TopUpStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  MANUAL_REVIEW: "Manual review",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
};

const CONFIRM_STATUSES: TopUpStatus[] = ["PAID", "FAILED", "EXPIRED", "REFUNDED"];

export function TopUpStatusControl({
  topUpId,
  status,
  compact = false,
}: {
  topUpId: string;
  status: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmStatus, setConfirmStatus] = useState<TopUpStatus | null>(null);
  const [reason, setReason] = useState("");

  const current = (TOP_UP_STATUSES.includes(status as TopUpStatus) ? status : "PENDING") as TopUpStatus;
  const locked = current === "PAID" || current === "REFUNDED";

  function applyStatus(next: TopUpStatus) {
    start(async () => {
      try {
        await setTopUpStatusAction(topUpId, next, {
          reason: next === "FAILED" ? reason || "Marked failed by admin" : undefined,
          notes: `Status changed to ${next} by admin`,
        });
        setConfirmStatus(null);
        setReason("");
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not update status");
      }
    });
  }

  function handleSelect(next: TopUpStatus) {
    if (next === current) return;
    if (CONFIRM_STATUSES.includes(next)) {
      setConfirmStatus(next);
      return;
    }
    applyStatus(next);
  }

  if (confirmStatus) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2",
          compact ? "max-w-xs" : "max-w-md",
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="text-xs text-amber-100/90">
          Set to <strong>{STATUS_LABELS[confirmStatus]}</strong>?
          {confirmStatus === "PAID" && " · Credits customer wallet"}
        </span>
        {confirmStatus === "FAILED" && (
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 min-w-[10rem] flex-1 rounded-md border border-white/10 bg-black/30 px-2 text-xs"
          />
        )}
        <Button
          type="button"
          size="sm"
          disabled={pending}
          className="h-7 px-2.5 text-xs"
          onClick={() => applyStatus(confirmStatus)}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          className="h-7 px-2.5 text-xs"
          onClick={() => {
            setConfirmStatus(null);
            setReason("");
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  const selectLabel = pending ? "Saving…" : locked ? STATUS_LABELS[current] : "Change status";

  return (
    <div className={cn("flex items-center gap-2", compact && "justify-end")}>
      {!compact && <BillingStatusBadge status={current} />}
      <Select
        value={current}
        onValueChange={(v) => handleSelect(v as TopUpStatus)}
        disabled={pending || locked}
      >
        <SelectTrigger
          className={cn(
            "border-white/10 bg-black/20 shadow-none hover:border-white/15",
            compact ? "h-8 w-[9.5rem] text-xs" : "h-9 w-[11rem] text-sm",
          )}
        >
          <SelectValue placeholder={selectLabel} />
        </SelectTrigger>
        <SelectContent align="end">
          {TOP_UP_STATUSES.map((s) => (
            <SelectItem key={s} value={s} disabled={s === current}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
