"use client";

import { useEffect, useMemo, useState } from "react";
import {
  purchaseDedicatedViaTicketAction,
  purchaseInventoryDedicatedViaTicketAction,
} from "@/app/actions/ticket-purchase";
import { checkSufficientBalance } from "@/app/actions/order";
import { Panel } from "@/components/ui/enterprise/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { OrderButton } from "@/components/plans/order-button";
import { formatMoney } from "@/lib/utils";
import type { DedicatedCatalogPlan } from "@/lib/dedicated-plans";
import { isDedicatedPlanDetailed } from "@/lib/dedicated-plans";
import { DedicatedPlanCard } from "@/components/plans/dedicated-plan-card";
import {
  DEFAULT_VPS_OS,
  STANDARD_VPS_OS_OPTIONS,
  type VpsOsOption,
} from "@/lib/vps-os-options";
import {
  BULLETPROOF_OFFSHORE_LOCATION_DEFS,
  filterLocationsByCountryCodes,
  getTranslatedLocationRegionLabel,
  STANDARD_VPS_LOCATION_DEFS,
} from "@/lib/vps-plan-locations";
import type { TicketOrderProductLine } from "@/lib/ticket-order-copy";
import { handlePurchaseError, toastInsufficientBalance } from "@/lib/toast";
import { getPromoErrorMessage } from "@/lib/promo-errors";
import { useI18n } from "@/lib/i18n/store";

type Location = {
  id: string;
  name: string;
  code: string;
  country: string;
  city?: string | null;
};

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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono text-sm font-medium tracking-tight">{spec}</p>
      <div className="flex shrink-0 items-center gap-4">
        <span className="text-lg font-semibold tabular-nums">
          {formatMoney(plan.price)}
          <span className="text-xs font-normal text-muted-foreground">{t("plans.perMonth")}</span>
        </span>
        <OrderButton
          amount={plan.price}
          className="h-8"
          showSuccessFlow={false}
          onAllowed={() =>
            purchaseDedicatedViaTicketAction({ planId: plan.id, productLine })
          }
        >
          {t("plans.buy")}
        </OrderButton>
      </div>
    </div>
  );
}

export function DedicatedPlansTab({
  inventory,
  locations,
  description,
  bulletproof = false,
  title,
  catalog,
  detailedCatalog = false,
  panelTitle,
  deployLabel,
  osOptions = STANDARD_VPS_OS_OPTIONS,
  allowedCountryCodes,
  locationCountryLabels = false,
}: {
  inventory: InventoryItem[];
  locations: Location[];
  description: string;
  bulletproof?: boolean;
  title?: string;
  catalog?: readonly DedicatedCatalogPlan[];
  detailedCatalog?: boolean;
  panelTitle?: string;
  deployLabel?: string;
  osOptions?: readonly VpsOsOption[];
  /** Restrict region list (e.g. RU/BY/AB standard, NL/DE/US/TR bulletproof) */
  allowedCountryCodes?: readonly string[];
  locationCountryLabels?: boolean;
}) {
  const { t } = useI18n();
  const detailedPlans = useMemo(
    () => (catalog ?? []).filter(isDedicatedPlanDetailed),
    [catalog],
  );
  const showCatalog = catalog && catalog.length > 0;
  const useDetailedCards =
    detailedCatalog && detailedPlans.length > 0;
  const productLine: Extract<TicketOrderProductLine, "bulletproof-dedicated" | "dedicated"> =
    bulletproof ? "bulletproof-dedicated" : "dedicated";

  const [selectedPlan, setSelectedPlan] = useState(detailedPlans[0]?.id ?? "");
  const [locationId, setLocationId] = useState("");
  const [os, setOs] = useState(DEFAULT_VPS_OS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableLocations = useMemo(() => {
    const locationDefs = bulletproof
      ? BULLETPROOF_OFFSHORE_LOCATION_DEFS
      : STANDARD_VPS_LOCATION_DEFS;

    let list = [...locations];
    if (allowedCountryCodes?.length) {
      list = filterLocationsByCountryCodes(list, allowedCountryCodes);
      if (list.length === 0 && locations.length > 0) {
        const byCode = new Map(locations.map((l) => [l.code, l]));
        list = locationDefs.map((def) => byCode.get(def.code)).filter(
          (l): l is Location => l != null,
        );
        if (allowedCountryCodes.length) {
          list = filterLocationsByCountryCodes(list, allowedCountryCodes);
        }
      }
    }
    if (allowedCountryCodes?.length && list.length > 1) {
      const order: string[] = locationDefs.map((d) => d.code);
      list.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
    }
    return list;
  }, [locations, allowedCountryCodes, bulletproof]);

  useEffect(() => {
    if (detailedPlans.length > 0 && !detailedPlans.some((p) => p.id === selectedPlan)) {
      setSelectedPlan(detailedPlans[0].id);
    }
  }, [detailedPlans, selectedPlan]);

  useEffect(() => {
    if (availableLocations.length === 0) {
      setLocationId("");
      return;
    }
    setLocationId((current) =>
      availableLocations.some((loc) => loc.id === current) ? current : availableLocations[0].id,
    );
  }, [availableLocations]);

  const selected = detailedPlans.find((p) => p.id === selectedPlan);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("planId", selectedPlan);
    form.set("productLine", productLine);
    try {
      const { sufficient } = await checkSufficientBalance(selected.price);
      if (!sufficient) {
        toastInsufficientBalance();
        setLoading(false);
        return;
      }
      await purchaseDedicatedViaTicketAction(form);
    } catch (err) {
      if (!handlePurchaseError(err)) {
        const message = err instanceof Error ? err.message : "";
        setError(message ? getPromoErrorMessage(message, t) : t("plans.deployFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  if (showCatalog && useDetailedCards) {
    const orderLabel = deployLabel ?? t("plans.buy");

    return (
      <div className="space-y-8">
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3">
              {detailedPlans.map((plan) => (
                <DedicatedPlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan === plan.id}
                  onSelect={() => setSelectedPlan(plan.id)}
                />
              ))}
            </div>
          </div>

          <div className="xl:col-span-4">
            <Panel
              title={panelTitle ?? t("plans.stdVpsPanel")}
              description={
                selected
                  ? t("plans.spec.panelVcpu", {
                      name: selected.name ?? selected.cpu,
                      cpu: selected.cpuCores ?? 0,
                    })
                  : undefined
              }
              className="xl:sticky xl:top-20"
              allowOverflow
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="hidden" name="planId" value={selectedPlan} />
                <input type="hidden" name="productLine" value={productLine} />
                <div className="space-y-2">
                  <label htmlFor="hostname" className="text-sm font-medium">
                    {t("plans.form.hostname")}
                  </label>
                  <Input id="hostname" name="hostname" placeholder="srv-01" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("plans.form.region")}</label>
                  {availableLocations.length === 0 ? (
                    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {t("plans.form.regionsLoading")}
                    </p>
                  ) : (
                    <NativeSelect
                      id="locationId"
                      name="locationId"
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      required
                      disabled={availableLocations.length === 0}
                    >
                      {availableLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {locationCountryLabels
                            ? getTranslatedLocationRegionLabel(loc, t)
                            : loc.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("plans.form.os")}</label>
                  <NativeSelect
                    id="os"
                    name="os"
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    required
                  >
                    {osOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <label htmlFor="promoCode" className="text-sm font-medium">
                    {t("plans.form.promoCode")}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({t("plans.form.optional")})
                    </span>
                  </label>
                  <Input
                    id="promoCode"
                    name="promoCode"
                    placeholder="ORDER10"
                    autoComplete="off"
                    className="font-mono uppercase"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !selectedPlan}>
                  {loading ? t("plans.processing") : orderLabel}
                </Button>
              </form>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

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
      </div>
    );
  }

  return (
    <InventorySection inventory={inventory} bulletproof={bulletproof} title={title} description={description} />
  );
}

function InventorySection({
  inventory,
  bulletproof,
  title,
  description,
}: {
  inventory: InventoryItem[];
  bulletproof: boolean;
  title?: string;
  description?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
      {description && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{description}</p>
          {bulletproof && <Badge variant="muted">{t("plans.dedicated.badgeBpPolicy")}</Badge>}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {inventory.map((item) => (
          <div
            key={item.id}
            className="card-interactive rounded-lg border border-border bg-card p-5"
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
              showSuccessFlow={false}
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
              {t("plans.buy")}
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
