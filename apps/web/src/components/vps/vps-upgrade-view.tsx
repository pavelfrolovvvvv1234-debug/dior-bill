"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/enterprise/panel";
import { formatMoney } from "@/lib/utils";
import { listVpsUpgradeOptions, type VpsPlan } from "@/lib/vps-plans";
import { createVpsUpgradeInvoiceAction } from "@/app/actions/vps-upgrade";
import { useI18n } from "@/lib/i18n/store";
import { ArrowLeft } from "lucide-react";

type VpsUpgradeViewProps = {
  vpsId: string;
  hostname: string;
  current: {
    cpuCores: number;
    ramMb: number;
    diskGb: number;
    monthlyPrice: number;
  };
};

export function VpsUpgradeView({ vpsId, hostname, current }: VpsUpgradeViewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => "");
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => listVpsUpgradeOptions(current), [current]);
  const selected =
    options.find((p) => p.id === (selectedPlanId || options[0]?.id)) ?? options[0];

  const upgradeFee =
    selected != null
      ? Math.round((selected.price - current.monthlyPrice) * 100) / 100
      : 0;

  function planSummary(plan: VpsPlan) {
    return `${plan.cpuCores} vCPU · ${plan.ramMb / 1024} GB · ${plan.diskGb} GB`;
  }

  function handleUpgrade() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const invoiceId = await createVpsUpgradeInvoiceAction(vpsId, selected.id);
        router.push(`/billing/invoices/${invoiceId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("services.upgradeFailed"));
      }
    });
  }

  if (options.length === 0) {
    return (
      <Panel>
        <p className="py-10 text-center text-sm text-muted-foreground">{t("services.upgradeNone")}</p>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 -ml-2" asChild>
        <FastLink href={`/vps/${vpsId}`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {hostname}
        </FastLink>
      </Button>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("services.upgradeTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("services.upgradeDesc", { hostname })}</p>
      </div>

      <Panel className="space-y-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("services.upgradeCurrent")}
          </p>
          <p className="mt-1 font-medium">{planSummary({ ...current, id: "", name: "", price: current.monthlyPrice, networkMbps: 0, bandwidthLabel: "", bandwidthTb: 0 })}</p>
          <p className="text-sm text-muted-foreground">
            {formatMoney(current.monthlyPrice)}
            {t("plans.perMonth")}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="upgrade-plan">
            {t("services.upgradeSelect")}
          </label>
          <select
            id="upgrade-plan"
            className="h-10 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm"
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            disabled={pending}
          >
            {options.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {planSummary(plan)} — {formatMoney(plan.price)}
                {t("plans.perMonth")}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("services.upgradeDueNow")}</span>
              <span className="font-mono font-medium">{formatMoney(upgradeFee)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-muted-foreground">{t("services.upgradeNewMonthly")}</span>
              <span className="font-mono">{formatMoney(selected.price)}{t("plans.perMonth")}</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" disabled={pending || !selected} onClick={handleUpgrade}>
          {pending ? t("plans.processing") : t("services.upgradeConfirm")}
        </Button>
      </Panel>
    </div>
  );
}
