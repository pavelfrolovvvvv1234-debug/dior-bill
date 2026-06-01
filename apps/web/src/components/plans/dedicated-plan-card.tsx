"use client";

import { purchaseDedicatedViaTicketAction } from "@/app/actions/ticket-purchase";
import { OrderButton } from "@/components/plans/order-button";
import { formatMoney } from "@/lib/utils";
import type { DedicatedCatalogPlan } from "@/lib/dedicated-plans";
import { isDedicatedPlanDetailed } from "@/lib/dedicated-plans";
import type { TicketOrderProductLine } from "@/lib/ticket-order-copy";
import { useI18n } from "@/lib/i18n/store";

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
  productLine,
}: {
  plan: DedicatedCatalogPlan;
  productLine: Extract<TicketOrderProductLine, "bulletproof-dedicated" | "dedicated">;
}) {
  const { t } = useI18n();

  if (!isDedicatedPlanDetailed(plan)) return null;

  const bandwidth =
    plan.bandwidth === "Unlimited" ? t("plans.unlimited") : plan.bandwidth;

  return (
    <div className="flex h-full flex-col rounded-lg border border-white/6 bg-white/[0.02] p-4 transition-premium hover:border-white/12">
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
      <OrderButton
        amount={plan.price}
        className="mt-3 h-9 w-full"
        variant="outline"
        size="default"
        onAllowed={() =>
          purchaseDedicatedViaTicketAction({ planId: plan.id, productLine })
        }
      >
        {t("plans.dedicated.order")}
      </OrderButton>
    </div>
  );
}
