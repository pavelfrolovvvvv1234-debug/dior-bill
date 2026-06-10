"use client";

import { Panel } from "@/components/ui/enterprise/panel";
import { OrderButton } from "@/components/plans/order-button";
import { formatMoney } from "@/lib/utils";
import { CDN_PLANS, type CdnPlan } from "@/lib/cdn-plans";
import { useI18n } from "@/lib/i18n/store";

function CdnPlanRow({ plan }: { plan: CdnPlan }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/6 bg-white/[0.03] px-4 py-3 transition-premium hover:border-white/12 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold tracking-tight">
        <span className="mr-2" aria-hidden>
          {plan.icon}
        </span>
        {plan.name}
      </p>
      <div className="flex shrink-0 items-center gap-4">
        <span className="text-lg font-semibold tabular-nums">
          from {formatMoney(plan.priceFrom)}
        </span>
        <OrderButton amount={plan.priceFrom} className="h-8">
          {t("plans.buy")}
        </OrderButton>
      </div>
    </div>
  );
}

export function CdnPlansTab() {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold tracking-tight">
        <span className="mr-2" aria-hidden>
          📦
        </span>
        CDN Plans
      </h3>
      <p className="text-sm text-muted-foreground">
        Edge delivery with optional DDoS protection and bundled VDS.
      </p>
      <Panel title="Plans" description={`${CDN_PLANS.length} tiers`}>
        <div className="space-y-2">
          {CDN_PLANS.map((plan) => (
            <CdnPlanRow key={plan.id} plan={plan} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
