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
import { FormSelect, SelectItem } from "@/components/ui/select";
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
  getLocationCountryLabel,
} from "@/lib/vps-plan-locations";

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
    }
    if (filterLocationsByPlan) {
      list = filterLocationsForBulletproofPlan(list, selectedPlan, true);
    }
    return list;
  }, [locations, allowedCountryCodes, filterLocationsByPlan, selectedPlan]);

  useEffect(() => {
    if (availableLocations.length === 0) {
      setLocationId("");
      return;
    }
    if (!availableLocations.some((loc) => loc.id === locationId)) {
      setLocationId(availableLocations[0].id);
    }
  }, [availableLocations, locationId]);

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
        setError(err instanceof Error ? err.message : "Deploy failed");
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
          description={selected ? `${selected.name} — ${selected.cpuCores} vCPU` : undefined}
          className="xl:sticky xl:top-20"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="planId" value={selectedPlan} />
            <div className="space-y-2">
              <label htmlFor="hostname" className="text-sm font-medium">
                Hostname
              </label>
              <Input id="hostname" name="hostname" placeholder="srv-01" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Region</label>
              <FormSelect
                name="locationId"
                value={locationId}
                onValueChange={setLocationId}
                placeholder="Select location"
                required
              >
                {availableLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {filterLocationsByPlan || locationCountryLabels
                      ? getLocationCountryLabel(loc)
                      : loc.name}
                  </SelectItem>
                ))}
              </FormSelect>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Operating system</label>
              <FormSelect name="os" value={os} onValueChange={setOs} required>
                {osOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </FormSelect>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !selectedPlan}>
              {loading
                ? purchaseViaTicket
                  ? "Processing…"
                  : "Creating order…"
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
