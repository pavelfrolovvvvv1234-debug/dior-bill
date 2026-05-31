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
import { Timeline } from "@/components/ui/timeline";
import { syncTopUpAction } from "@/app/actions/topup";
import { isExternalPaymentUrl, openPaymentUrl } from "@/lib/payment-url";
import { formatMoney, formatDate } from "@/lib/utils";
import { MANUAL_SUPPORT_TELEGRAM } from "@dior/shared";
import { useI18n } from "@/lib/i18n/store";
import { useTopUpProviderLabel } from "@/lib/i18n/use-topup-providers";

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
  const { t } = useI18n();
  const [topUp, setTopUp] = useState(initial);
  const providerName = useTopUpProviderLabel(topUp.provider as import("@dior/shared").TopUpProviderId);
  const [copied, setCopied] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const isManual = topUp.provider === "MANUAL_TRANSFER";
  const isPaid = topUp.status === "PAID";
  const isPending = ["PENDING", "PROCESSING", "MANUAL_REVIEW"].includes(topUp.status);
  const paymentUrl = topUp.paymentUrl;
  const hasExternalPayment =
    Boolean(paymentUrl) && isExternalPaymentUrl(paymentUrl as string);

  useEffect(() => {
    if (!isPending || isPaid || isManual || !hasExternalPayment || !paymentUrl) return;
    const key = `topup-pay-opened:${topUp.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    openPaymentUrl(paymentUrl);
  }, [topUp.id, isPending, isPaid, isManual, hasExternalPayment, paymentUrl]);

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
        <h2 className="text-2xl font-semibold tracking-tight">{t("billing.detail.paymentConfirmed")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("billing.detail.credited", { amount: formatMoney(Number(topUp.netAmount)) })}
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <Button className="w-full sm:w-auto" asChild>
            <FastLink href="/billing">{t("billing.detail.viewBilling")}</FastLink>
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <FastLink href="/dashboard">{t("billing.detail.dashboard")}</FastLink>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Card className="overflow-hidden border-primary/20">
        <div className="h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/40" />
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-lg sm:text-xl">{providerName}</CardTitle>
            <p className="mt-1 break-all font-mono text-sm text-muted-foreground">{topUp.referenceCode}</p>
          </div>
          <TopUpStatusBadge status={topUp.status} className="w-fit shrink-0" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <Stat label={t("common.amount")} value={formatMoney(Number(topUp.amount))} />
            <Stat label={t("common.fee")} value={formatMoney(Number(topUp.fee))} />
            <Stat label={t("billing.detail.youReceive")} value={formatMoney(Number(topUp.netAmount))} highlight />
            <Stat label={t("billing.detail.created")} value={formatDate(topUp.createdAt)} />
            {topUp.expiresAt && (
              <Stat label={t("billing.detail.expires")} value={formatDate(topUp.expiresAt)} />
            )}
          </div>

          {isManual ? (
            <ManualTransferCard
              referenceCode={topUp.referenceCode}
              amount={Number(topUp.amount)}
              copied={copied}
              onCopy={copy}
              t={t}
            />
          ) : paymentUrl ? (
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full gap-2"
                size="lg"
                onClick={() => {
                  if (hasExternalPayment) {
                    openPaymentUrl(paymentUrl);
                  }
                }}
                disabled={!hasExternalPayment}
              >
                {t("billing.detail.openInvoice")}
                <ExternalLink className="h-4 w-4" />
              </Button>
              {!hasExternalPayment && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                  {t("billing.detail.paymentNotConfigured")}
                </p>
              )}
            </div>
          ) : null}

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
              {t("billing.detail.refreshStatus")}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <FastLink href="/billing/topup">{t("billing.detail.newTopup")}</FastLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("billing.detail.activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline
            items={topUp.events.map((ev) => ({
              id: `${ev.event}-${ev.createdAt.toISOString()}`,
              title: ev.event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              meta: formatDate(ev.createdAt),
            }))}
          />
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
  t,
}: {
  referenceCode: string;
  amount: number;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const telegramUrl = `https://t.me/${MANUAL_SUPPORT_TELEGRAM.replace("@", "")}`;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 text-amber-500" />
        <div>
          <p className="font-medium">{t("billing.detail.manualTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("billing.detail.manualBody")}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg bg-background/80 p-4 font-mono text-sm">
        <Row label={t("billing.detail.paymentId")} value={referenceCode} copied={copied} copyKey="ref" onCopy={onCopy} t={t} />
        <Row
          label={t("common.amount")}
          value={`$${amount.toFixed(2)} USD`}
          copied={copied}
          copyKey="amt"
          onCopy={onCopy}
          t={t}
        />
        <Row
          label={t("billing.detail.support")}
          value={MANUAL_SUPPORT_TELEGRAM}
          copied={copied}
          copyKey="tg"
          onCopy={onCopy}
          t={t}
        />
      </div>

      <Button className="w-full gap-2" asChild>
        <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          {t("billing.detail.openSupport", { telegram: MANUAL_SUPPORT_TELEGRAM })}
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
  t,
}: {
  label: string;
  value: string;
  copied: string | null;
  copyKey: string;
  onCopy: (text: string, key: string) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onCopy(value, copyKey)}
        className="flex min-w-0 items-center gap-1 text-left hover:text-primary sm:justify-end"
      >
        <span className="break-all">{value}</span>
        <Copy className="h-3 w-3 shrink-0" />
        {copied === copyKey && (
          <span className="shrink-0 text-[10px] text-emerald-500">{t("common.copied")}</span>
        )}
      </button>
    </div>
  );
}
