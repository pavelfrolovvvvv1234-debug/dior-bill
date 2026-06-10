"use client";

import { formatMoney } from "@/lib/utils";
import type { DedicatedCatalogPlan } from "@/lib/dedicated-plans";
import { isDedicatedPlanDetailed } from "@/lib/dedicated-plans";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function DedicatedPlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: DedicatedCatalogPlan;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useI18n();

  if (!isDedicatedPlanDetailed(plan)) return null;

  const bandwidth =
    plan.bandwidth === "Unlimited" ? t("plans.unlimited") : plan.bandwidth;

  const content = (
    <>
      <p className="text-sm font-semibold leading-snug">{plan.name}</p>
      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        <SpecRow
          label={t("plans.spec.cpu")}
          value={t("plans.spec.cpuCores", { count: plan.cpuCores })}
        />
        <SpecRow label={t("plans.spec.ram")} value={plan.ram} />
        <SpecRow label={t("plans.spec.storage")} value={plan.storage} />
        <SpecRow label={t("plans.spec.network")} value={plan.network} />
        <SpecRow label={t("plans.spec.bandwidth")} value={bandwidth} />
      </div>
      <p className="mt-4 text-xl font-semibold tabular-nums">
        {formatMoney(plan.price)}
        <span className="text-xs font-normal text-muted-foreground">{t("plans.perMonth")}</span>
      </p>
    </>
  );

  const className = cn(
    "card-interactive flex h-full w-full flex-col rounded-lg border border-border bg-card p-4 text-left",
    selected && "border-primary/40 bg-primary/5",
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
