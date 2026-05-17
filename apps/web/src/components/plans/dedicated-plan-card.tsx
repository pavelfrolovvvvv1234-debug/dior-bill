import { purchaseDedicatedViaTicketAction } from "@/app/actions/ticket-purchase";
import { OrderButton } from "@/components/plans/order-button";
import { formatMoney } from "@/lib/utils";
import type { DedicatedCatalogPlan } from "@/lib/dedicated-plans";
import { isDedicatedPlanDetailed } from "@/lib/dedicated-plans";
import type { TicketOrderProductLine } from "@/lib/ticket-order-copy";

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
  if (!isDedicatedPlanDetailed(plan)) return null;

  return (
    <div className="flex h-full flex-col rounded-lg border border-white/6 bg-white/[0.02] p-4 transition-premium hover:border-white/12">
      <p className="text-sm font-semibold leading-snug">{plan.name}</p>
      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        <SpecRow label="CPU" value={`${plan.cpuCores} cores`} />
        <SpecRow label="RAM" value={plan.ram} />
        <SpecRow label="Storage" value={plan.storage} />
        <SpecRow label="Network" value={plan.network} />
        <SpecRow label="Bandwidth" value={plan.bandwidth} />
      </div>
      <p className="mt-4 text-xl font-semibold tabular-nums">
        {formatMoney(plan.price)}
        <span className="text-xs font-normal text-muted-foreground">/mo</span>
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
        Order
      </OrderButton>
    </div>
  );
}
