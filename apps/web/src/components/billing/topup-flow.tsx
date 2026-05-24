"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Wallet } from "lucide-react";
import {
  TOPUP_MIN_AMOUNT,
  TOPUP_MAX_AMOUNT,
  MANUAL_SUPPORT_TELEGRAM,
  type TopUpProviderId,
} from "@dior/shared";
import { useI18n } from "@/lib/i18n/store";
import { useTopUpProviders } from "@/lib/i18n/use-topup-providers";

const TELEGRAM_SUPPORT_URL = `https://t.me/${MANUAL_SUPPORT_TELEGRAM.replace("@", "")}`;
import { PaymentMethodCard } from "./payment-method-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/enterprise/panel";
import { KpiCard } from "@/components/ui/enterprise/kpi-card";
import { createTopUpAction } from "@/app/actions/topup";
import { formatMoney } from "@/lib/utils";

const presets = [25, 50, 100, 250, 500, 1000];

interface TopUpFlowProps {
  availableBalance: number;
  lockedBalance: number;
}

export function TopUpFlow({ availableBalance, lockedBalance }: TopUpFlowProps) {
  const router = useRouter();
  const { t } = useI18n();
  const providers = useTopUpProviders();
  const [provider, setProvider] = useState<TopUpProviderId>("HELEKET");
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const isManual = provider === "MANUAL_TRANSFER";
  const valid =
    isManual ||
    (numAmount >= TOPUP_MIN_AMOUNT &&
      numAmount <= TOPUP_MAX_AMOUNT &&
      providers.find((p) => p.id === provider)?.available);

  function openTelegramSupport() {
    window.open(TELEGRAM_SUPPORT_URL, "_blank", "noopener,noreferrer");
  }

  async function handleSubmit() {
    if (!valid) return;

    if (isManual) {
      openTelegramSupport();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = `topup_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const result = await createTopUpAction({
        amount: numAmount,
        provider: provider as import("@dior/database").TopUpProvider,
        idempotencyKey,
      });

      if (result.paymentUrl) {
        window.open(result.paymentUrl, "_blank", "noopener,noreferrer");
      }
      router.push(`/billing/topup/${result.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("billing.topup.createFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label={t("billing.availableBalance")}
          value={formatMoney(availableBalance)}
          hint={lockedBalance > 0 ? `${formatMoney(lockedBalance)} locked` : undefined}
          icon={Wallet}
        />
        <Panel title={t("billing.topup.paymentPolicy")} description={t("billing.topup.paymentPolicyDesc")}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("billing.topup.paymentPolicyBody")}
          </p>
        </Panel>
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-tight">{t("billing.topup.paymentMethod")}</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">{t("billing.topup.paymentMethodHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {providers.filter((p) => p.available).map((p) => (
            <PaymentMethodCard
              key={p.id}
              provider={p}
              selected={provider === p.id}
              onSelect={() => setProvider(p.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-tight">{t("billing.topup.amount")}</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          {t("billing.topup.amountRange", {
            min: TOPUP_MIN_AMOUNT,
            max: TOPUP_MAX_AMOUNT.toLocaleString(),
          })}
        </p>
        <Panel>
          <div className="max-w-xl space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`rounded-md border px-2 py-1.5 text-sm font-medium tabular-nums transition-enterprise sm:px-3 ${
                    Number(amount) === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  ${p}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min={TOPUP_MIN_AMOUNT}
                max={TOPUP_MAX_AMOUNT}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 pl-7 text-lg font-semibold tabular-nums"
                placeholder="0.00"
              />
            </div>
            {isManual && (
              <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                {t("billing.topup.manualHint", { telegram: MANUAL_SUPPORT_TELEGRAM })}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="h-10 w-full gap-2" disabled={!valid || loading} onClick={handleSubmit}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("billing.topup.creatingInvoice")}
                </>
              ) : isManual ? (
                <>{t("billing.topup.openTelegram", { telegram: MANUAL_SUPPORT_TELEGRAM })}</>
              ) : (
                <>
                  {t("billing.topup.continuePayment")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </Panel>
      </section>
    </div>
  );
}
