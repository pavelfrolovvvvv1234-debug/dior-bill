"use client";

import { useState } from "react";
import { PurchaseSuccessDialog } from "@/components/billing/purchase-success-dialog";
import { deployVpsAction } from "@/app/actions/vps";
import { checkSufficientBalance } from "@/app/actions/order";
import { handlePurchaseError, toastInsufficientBalance } from "@/lib/toast";
import { VPS_PLANS, TURBO_VPS_PLANS } from "@/lib/vps-plans";
import { Panel } from "@/components/ui/enterprise/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatMoney } from "@/lib/utils";
import { DEFAULT_VPS_OS, STANDARD_VPS_OS_OPTIONS } from "@/lib/vps-os-options";

interface Location {
  id: string;
  name: string;
  code: string;
}

interface Plan {
  id: string;
  name: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  price: number;
}

export function VpsDeployForm({
  locations,
  plans,
}: {
  locations: Location[];
  plans: readonly Plan[];
}) {
  const [locationId, setLocationId] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [os, setOs] = useState(DEFAULT_VPS_OS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const submittedPlanId = String(formData.get("planId") ?? "");
    const allPlans = [...VPS_PLANS, ...TURBO_VPS_PLANS];
    const plan =
      allPlans.find((p) => p.id === submittedPlanId) ??
      plans.find((p) => p.id === submittedPlanId);
    try {
      if (plan) {
        const { sufficient } = await checkSufficientBalance(plan.price);
        if (!sufficient) {
          toastInsufficientBalance();
          setLoading(false);
          return;
        }
      }
      await deployVpsAction(formData);
      setPurchaseSuccessOpen(true);
    } catch (err) {
      if (!handlePurchaseError(err)) {
        setError(err instanceof Error ? err.message : "Deploy failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <Panel title="Server configuration">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="hostname" className="text-sm font-medium">
            Hostname
          </label>
          <Input id="hostname" name="hostname" placeholder="srv-01" required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Region</label>
          <NativeSelect
            name="locationId"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select location
            </option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Plan</label>
          <NativeSelect
            name="planId"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            required
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.cpuCores} vCPU, {p.ramMb / 1024} GB RAM, {p.diskGb} GB —{" "}
                {formatMoney(p.price)}/mo
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Operating system</label>
          <NativeSelect name="os" value={os} onChange={(e) => setOs(e.target.value)} required>
            {STANDARD_VPS_OS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <label htmlFor="promoCode" className="text-sm font-medium">
            Promo code <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="promoCode"
            name="promoCode"
            placeholder="ORDER10"
            autoComplete="off"
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">
            Percent-off codes apply here. Balance-credit codes use Billing → Promo.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating order…" : "Deploy VPS"}
        </Button>
      </form>
    </Panel>
    <PurchaseSuccessDialog
      open={purchaseSuccessOpen}
      onOpenChange={setPurchaseSuccessOpen}
    />
    </>
  );
}
