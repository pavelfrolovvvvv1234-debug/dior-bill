"use client";

import { useEffect, useState } from "react";
import { FastLink } from "@/components/ui/fast-link";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { TopUpStatusBadge } from "./topup-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncTopUpAction } from "@/app/actions/topup";
import { formatMoney, formatDate } from "@/lib/utils";
import { MANUAL_SUPPORT_TELEGRAM, TOPUP_PROVIDER_META } from "@dior/shared";

interface TopUpDetailProps {
  topUp: {
    id: string;
    amount: unknown;
    fee: unknown;
    netAmount: unknown;
    provider: string;
    status: string;
    referenceCode: string;
    paymentUrl: string | null;
    expiresAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    failureReason: string | null;
    events: Array<{ event: string; createdAt: Date }>;
  };
}

export function TopUpDetail({ topUp: initial }: TopUpDetailProps) {
  const [topUp, setTopUp] = useState(initial);
  const [copied, setCopied] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const providerMeta = TOPUP_PROVIDER_META.find((p) => p.id === topUp.provider);
  const isManual = topUp.provider === "MANUAL_TRANSFER";
  const isPaid = topUp.status === "PAID";
  const isPending = ["PENDING", "PROCESSING", "MANUAL_REVIEW"].includes(topUp.status);

  useEffect(() => {
    if (!isPending || isPaid) return;
    const interval = setInterval(async () => {
      try {
        const updated = await syncTopUpAction(topUp.id);
        setTopUp((prev) => ({
          ...prev,
          status: updated?.status ?? prev.status,
          paidAt: updated?.paidAt ?? prev.paidAt,
        }));
      } catch {
        /* ignore */
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [topUp.id, isPending, isPaid]);

  async function handleSync() {
    setSyncing(true);
    try {
      const updated = await syncTopUpAction(topUp.id);
      if (updated) {
        setTopUp((prev) => ({
          ...prev,
          ...updated,
          amount: updated.amount,
          fee: updated.fee,
          netAmount: updated.netAmount,
        }));
      }
    } finally {
      setSyncing(false);
    }
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (isPaid) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Payment confirmed</h2>
        <p className="mt-2 text-muted-foreground">
          {formatMoney(Number(topUp.netAmount))} has been credited to your wallet
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <FastLink href="/billing">View billing</FastLink>
          </Button>
          <Button variant="outline" asChild>
            <FastLink href="/dashboard">Dashboard</FastLink>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="overflow-hidden border-primary/20">
        <div className="h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/40" />
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{providerMeta?.name ?? topUp.provider}</CardTitle>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{topUp.referenceCode}</p>
          </div>
          <TopUpStatusBadge status={topUp.status} />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Amount" value={formatMoney(Number(topUp.amount))} />
            <Stat label="Fee" value={formatMoney(Number(topUp.fee))} />
            <Stat label="You receive" value={formatMoney(Number(topUp.netAmount))} highlight />
            <Stat label="Created" value={formatDate(topUp.createdAt)} />
            {topUp.expiresAt && <Stat label="Expires" value={formatDate(topUp.expiresAt)} />}
          </div>

          {isManual ? (
            <ManualTransferCard
              referenceCode={topUp.referenceCode}
              amount={Number(topUp.amount)}
              copied={copied}
              onCopy={copy}
            />
          ) : (
            topUp.paymentUrl && (
              <Button className="w-full gap-2" size="lg" asChild>
                <a href={topUp.paymentUrl} target="_blank" rel="noopener noreferrer">
                  Open payment invoice
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )
          )}

          {topUp.failureReason && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {topUp.failureReason}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Refresh status
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <FastLink href="/billing/topup">New top-up</FastLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l border-border pl-6">
            {topUp.events.map((ev) => (
              <li key={`${ev.event}-${ev.createdAt.toISOString()}`} className="relative">
                <span className="absolute -left-[1.55rem] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                <p className="text-sm font-medium capitalize">{ev.event.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{formatDate(ev.createdAt)}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-medium ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function ManualTransferCard({
  referenceCode,
  amount,
  copied,
  onCopy,
}: {
  referenceCode: string;
  amount: number;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const telegramUrl = `https://t.me/${MANUAL_SUPPORT_TELEGRAM.replace("@", "")}`;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 text-amber-500" />
        <div>
          <p className="font-medium">Awaiting manual verification</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact support with your payment reference. Funds are credited after operator
            confirmation — typically within a few hours.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg bg-background/80 p-4 font-mono text-sm">
        <Row label="Payment ID" value={referenceCode} copied={copied} copyKey="ref" onCopy={onCopy} />
        <Row
          label="Amount"
          value={`$${amount.toFixed(2)} USD`}
          copied={copied}
          copyKey="amt"
          onCopy={onCopy}
        />
        <Row
          label="Support"
          value={MANUAL_SUPPORT_TELEGRAM}
          copied={copied}
          copyKey="tg"
          onCopy={onCopy}
        />
      </div>

      <Button className="w-full gap-2" asChild>
        <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          Open {MANUAL_SUPPORT_TELEGRAM}
        </a>
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  copied,
  copyKey,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string | null;
  copyKey: string;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onCopy(value, copyKey)}
        className="flex items-center gap-1 hover:text-primary"
      >
        {value}
        <Copy className="h-3 w-3" />
        {copied === copyKey && <span className="text-[10px] text-emerald-500">Copied</span>}
      </button>
    </div>
  );
}
