"use client";

import { FastLink } from "@/components/ui/fast-link";
import { useI18n } from "@/lib/i18n/store";
import { Button } from "@/components/ui/button";
import { TopUpStatusBadge } from "./topup-status-badge";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { formatMoney, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function RecentLedgerCard({
  description,
  createdAt,
  type,
  amount,
}: {
  description: string;
  createdAt: Date;
  type: string;
  amount: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{description}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(createdAt)}</p>
        </div>
        <p
          className={cn(
            "shrink-0 font-mono text-sm tabular-nums",
            type === "CREDIT" ? "text-success" : "text-foreground",
          )}
        >
          {type === "CREDIT" ? "+" : "−"}
          {formatMoney(amount)}
        </p>
      </div>
    </div>
  );
}

export function InvoiceCard({
  number,
  createdAt,
  status,
  total,
}: {
  number: string;
  createdAt: Date;
  status: string;
  total: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{number}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(createdAt)}</p>
        </div>
        <p className="shrink-0 font-mono text-sm font-medium tabular-nums">{formatMoney(total)}</p>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <InvoiceStatusBadge status={status} />
      </div>
    </div>
  );
}

export function TransactionLedgerCard({
  entry,
}: {
  entry: {
    id: string;
    kind: "topup" | "ledger";
    description: string;
    provider?: string;
    referenceCode?: string;
    createdAt: Date;
    status: string;
    netAmount: number;
  };
}) {
  const { t } = useI18n();
  const amountPositive = entry.status === "PAID" || entry.status === "CREDIT";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{entry.description}</p>
          {entry.provider && (
            <p className="mt-0.5 text-xs text-muted-foreground">{entry.provider}</p>
          )}
          {entry.referenceCode && (
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {entry.referenceCode}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
        </div>
        <p
          className={cn(
            "shrink-0 font-mono text-sm tabular-nums",
            amountPositive ? "text-success" : "text-foreground",
          )}
        >
          {amountPositive ? "+" : ""}
          {formatMoney(entry.netAmount)}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        {entry.kind === "topup" ? (
          <TopUpStatusBadge status={entry.status} />
        ) : (
          <span className="text-xs text-muted-foreground">{entry.status}</span>
        )}
        {entry.kind === "topup" && (
          <Button variant="outline" size="sm" className="h-8 shrink-0" asChild>
            <FastLink href={`/billing/topup/${entry.id}`}>{t("common.view")}</FastLink>
          </Button>
        )}
      </div>
    </div>
  );
}
