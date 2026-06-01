"use client";

import { purchaseDedicatedViaTicketAction, purchaseInventoryDedicatedViaTicketAction } from "@/app/actions/ticket-purchase";
import { Panel } from "@/components/ui/enterprise/panel";
import { Badge } from "@/components/ui/badge";
import { OrderButton } from "@/components/plans/order-button";
import { formatMoney } from "@/lib/utils";
import type { DedicatedCatalogPlan } from "@/lib/dedicated-plans";
import { isDedicatedPlanDetailed } from "@/lib/dedicated-plans";
import { DedicatedPlanCard } from "@/components/plans/dedicated-plan-card";
import type { TicketOrderProductLine } from "@/lib/ticket-order-copy";
import { useI18n } from "@/lib/i18n/store";

type InventoryItem = {
  id: string;
  name: string;
  cpu: string;
  stockAvail: number;
  lowStockAt: number;
  monthlyPrice: unknown;
};

function DedicatedCatalogRow({
  plan,
  productLine,
}: {
  plan: DedicatedCatalogPlan;
  productLine: Extract<TicketOrderProductLine, "bulletproof-dedicated" | "dedicated">;
}) {
  const { t } = useI18n();
  const spec = plan.storage
    ? `${plan.cpu} • ${plan.ram} • ${plan.storage}`
    : `${plan.cpu} • ${plan.ram}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/6 bg-white/[0.03] px-4 py-3 transition-premium hover:border-white/12 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono text-sm font-medium tracking-tight">{spec}</p>
      <div className="flex shrink-0 items-center gap-4">
        <span className="text-lg font-semibold tabular-nums">
          {formatMoney(plan.price)}
          <span className="text-xs font-normal text-muted-foreground">{t("plans.perMonth")}</span>
        </span>
        <OrderButton
          amount={plan.price}
          className="h-8"
          onAllowed={() =>
            purchaseDedicatedViaTicketAction({ planId: plan.id, productLine })
          }
        >
          {t("plans.dedicated.order")}
        </OrderButton>
      </div>
    </div>
  );
}

export function DedicatedPlansTab({
  inventory,
  description,
  bulletproof = false,
  title,
  catalog,
  detailedCatalog = false,
}: {
  inventory: InventoryItem[];
  description: string;
  bulletproof?: boolean;
  title?: string;
  catalog?: readonly DedicatedCatalogPlan[];
  detailedCatalog?: boolean;
}) {
  const { t } = useI18n();
  const showCatalog = catalog && catalog.length > 0;
  const useDetailedCards =
    detailedCatalog && catalog?.some((plan) => isDedicatedPlanDetailed(plan));
  const productLine: Extract<TicketOrderProductLine, "bulletproof-dedicated" | "dedicated"> =
    bulletproof ? "bulletproof-dedicated" : "dedicated";

  if (showCatalog) {
    return (
      <div className="space-y-6">
        {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{description}</p>
          {bulletproof ? (
            <>
              <Badge variant="muted">{t("plans.dedicated.badgeBpPolicy")}</Badge>
              <Badge variant="muted">{t("plans.dedicated.badgeDdos")}</Badge>
              <Badge variant="muted">{t("plans.dedicated.badgeAbuse")}</Badge>
            </>
          ) : (
            <>
              <Badge variant="muted">{t("plans.dedicated.badgeSla")}</Badge>
              <Badge variant="muted">{t("plans.dedicated.badgeDdos")}</Badge>
            </>
          )}
        </div>
        {useDetailedCards ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3">
            {catalog.map((plan) => (
              <DedicatedPlanCard key={plan.id} plan={plan} productLine={productLine} />
            ))}
          </div>
        ) : (
          <Panel
            title={t("plans.dedicated.availableConfigs")}
            description={t("plans.dedicated.bareMetalTiers", { count: catalog.length })}
          >
            <div className="space-y-2">
              {catalog.map((plan) => (
                <DedicatedCatalogRow key={plan.id} plan={plan} productLine={productLine} />
              ))}
            </div>
          </Panel>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">{description}</p>
        {bulletproof && <Badge variant="muted">{t("plans.dedicated.badgeBpPolicy")}</Badge>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {inventory.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-white/6 bg-white/[0.02] p-5 transition-premium hover:border-white/12"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{item.name}</p>
              <Badge variant={item.stockAvail <= item.lowStockAt ? "warning" : "success"}>
                {t("plans.dedicated.inStock", { count: item.stockAvail })}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.cpu}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="muted">{t("plans.dedicated.badgeSla")}</Badge>
              {bulletproof ? (
                <>
                  <Badge variant="muted">{t("plans.dedicated.badgeAbuse")}</Badge>
                  <Badge variant="muted">{t("plans.dedicated.badgeDdos")}</Badge>
                </>
              ) : (
                <Badge variant="muted">{t("plans.dedicated.badgeDdos")}</Badge>
              )}
            </div>
            <p className="mt-4 text-lg font-semibold tabular-nums">
              {formatMoney(Number(item.monthlyPrice))}
              <span className="text-xs font-normal text-muted-foreground">{t("plans.perMonth")}</span>
            </p>
            <OrderButton
              amount={Number(item.monthlyPrice)}
              className="mt-4 h-9 w-full"
              variant="outline"
              size="default"
              onAllowed={() =>
                purchaseInventoryDedicatedViaTicketAction({
                  inventoryId: item.id,
                  name: item.name,
                  cpu: item.cpu,
                  monthlyPrice: Number(item.monthlyPrice),
                  bulletproof,
                })
              }
            >
              {t("plans.dedicated.order")}
            </OrderButton>
          </div>
        ))}
      </div>
      {inventory.length === 0 && (
        <Panel>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("plans.dedicated.noInventory")}
          </p>
        </Panel>
      )}
    </div>
  );
}
