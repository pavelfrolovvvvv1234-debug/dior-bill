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
import { FormSelect, SelectItem } from "@/components/ui/select";
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
          <FormSelect
            name="locationId"
            value={locationId}
            onValueChange={setLocationId}
            placeholder="Select location"
            required
          >
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </SelectItem>
            ))}
          </FormSelect>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Plan</label>
          <FormSelect
            name="planId"
            value={planId}
            onValueChange={setPlanId}
            placeholder="Select plan"
            required
          >
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {p.cpuCores} vCPU, {p.ramMb / 1024} GB RAM, {p.diskGb} GB —{" "}
                {formatMoney(p.price)}/mo
              </SelectItem>
            ))}
          </FormSelect>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Operating system</label>
          <FormSelect name="os" value={os} onValueChange={setOs} required>
            {STANDARD_VPS_OS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </FormSelect>
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
