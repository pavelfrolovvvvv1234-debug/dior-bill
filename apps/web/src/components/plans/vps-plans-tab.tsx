"use client";

import { useEffect, useMemo, useState } from "react";
import { deployVpsAction } from "@/app/actions/vps";
import {
  purchaseStandardVpsViaTicketAction,
  purchaseTurbovdsViaTicketAction,
} from "@/app/actions/ticket-purchase";
import { checkSufficientBalance } from "@/app/actions/order";
import { handlePurchaseError, toastInsufficientBalance } from "@/lib/toast";
import { Panel } from "@/components/ui/enterprise/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PurchaseSuccessDialog } from "@/components/billing/purchase-success-dialog";
import { VpsPlanCard } from "./vps-plan-card";
import type { VpsPlan } from "@/lib/vps-plans";
import {
  DEFAULT_VPS_OS,
  STANDARD_VPS_OS_OPTIONS,
  type VpsOsOption,
} from "@/lib/vps-os-options";
import {
  filterLocationsByCountryCodes,
  filterLocationsForBulletproofPlan,
  getTranslatedLocationRegionLabel,
  STANDARD_VPS_LOCATION_DEFS,
} from "@/lib/vps-plan-locations";
import { useI18n } from "@/lib/i18n/store";

interface Location {
  id: string;
  name: string;
  code: string;
  country: string;
  city?: string | null;
}

export function VpsPlansTab({
  locations,
  plans,
  title,
  description = "Offshore VPS with manual abuse review. Select a plan, region, and deploy.",
  deployLabel = "Deploy VPS",
  panelTitle = "Deploy configuration",
  detailedCatalog = false,
  osOptions = STANDARD_VPS_OS_OPTIONS,
  filterLocationsByPlan = false,
  allowedCountryCodes,
  locationCountryLabels = false,
  purchaseViaTicket = false,
  ticketKind = "turbovds",
}: {
  locations: Location[];
  plans: readonly VpsPlan[];
  title?: string;
  description?: string;
  deployLabel?: string;
  panelTitle?: string;
  detailedCatalog?: boolean;
  osOptions?: readonly VpsOsOption[];
  /** Bulletproof VPS: Lite → NL only; Elite/Mega → NL, DE, US, TR */
  filterLocationsByPlan?: boolean;
  /** Restrict region list (e.g. RU, BY, AB for standard VPS) */
  allowedCountryCodes?: readonly string[];
  /** Show country names in region picker (bulletproof + standard VPS) */
  locationCountryLabels?: boolean;
  /** Charge balance and open support ticket instead of instant deploy */
  purchaseViaTicket?: boolean;
  ticketKind?: "turbovds" | "standard-vps";
}) {
  const { t } = useI18n();
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id ?? "");
  const [locationId, setLocationId] = useState("");
  const [os, setOs] = useState(DEFAULT_VPS_OS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);

  const availableLocations = useMemo(() => {
    let list = [...locations];
    if (allowedCountryCodes?.length) {
      list = filterLocationsByCountryCodes(list, allowedCountryCodes);
      if (list.length === 0 && locations.length > 0) {
        const byCode = new Map(locations.map((l) => [l.code, l]));
        list = STANDARD_VPS_LOCATION_DEFS.map((def) => byCode.get(def.code)).filter(
          (l): l is Location => l != null,
        );
      }
    }
    if (filterLocationsByPlan) {
      list = filterLocationsForBulletproofPlan(list, selectedPlan, true);
    }
    if (allowedCountryCodes?.length && list.length > 1) {
      const order: string[] = STANDARD_VPS_LOCATION_DEFS.map((d) => d.code);
      list.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
    }
    return list;
  }, [locations, allowedCountryCodes, filterLocationsByPlan, selectedPlan]);

  useEffect(() => {
    if (availableLocations.length === 0) {
      setLocationId("");
      return;
    }
    setLocationId((current) =>
      availableLocations.some((loc) => loc.id === current) ? current : availableLocations[0].id,
    );
  }, [availableLocations]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("planId", selectedPlan);
    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) {
      setLoading(false);
      return;
    }
    try {
      const { sufficient } = await checkSufficientBalance(plan.price);
      if (!sufficient) {
        toastInsufficientBalance();
        setLoading(false);
        return;
      }
      if (purchaseViaTicket) {
        if (ticketKind === "standard-vps") {
          await purchaseStandardVpsViaTicketAction(form);
        } else {
          await purchaseTurbovdsViaTicketAction(form);
        }
      } else {
        await deployVpsAction(form);
      }
      setPurchaseSuccessOpen(true);
    } catch (err) {
      if (!handlePurchaseError(err)) {
        setError(err instanceof Error ? err.message : t("plans.deployFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  const selected = plans.find((p) => p.id === selectedPlan);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-8">
        {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
        <p className="text-sm text-muted-foreground">{description}</p>
        <div
          className={
            detailedCatalog
              ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3"
              : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          }
        >
          {plans.map((plan) => (
            <VpsPlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan === plan.id}
              onSelect={() => setSelectedPlan(plan.id)}
              detailed={detailedCatalog}
            />
          ))}
        </div>
      </div>

      <div className="xl:col-span-4">
        <Panel
          title={panelTitle}
          description={
            selected
              ? t("plans.spec.panelVcpu", { name: selected.name, cpu: selected.cpuCores })
              : undefined
          }
          className="xl:sticky xl:top-20"
          allowOverflow
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="planId" value={selectedPlan} />
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
                      {filterLocationsByPlan || locationCountryLabels
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
                <span className="font-normal text-muted-foreground">({t("plans.form.optional")})</span>
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
              {loading
                ? purchaseViaTicket
                  ? t("plans.processing")
                  : t("plans.creatingOrder")
                : deployLabel}
            </Button>
          </form>
        </Panel>
      </div>

      <PurchaseSuccessDialog
        open={purchaseSuccessOpen}
        onOpenChange={setPurchaseSuccessOpen}
      />
    </div>
  );
}
