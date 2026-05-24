"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanProductNav } from "./plan-product-nav";
import { VpsPlansTab } from "./vps-plans-tab";
import { DedicatedPlansTab } from "./dedicated-plans-tab";
import { DomainsPlansTab } from "./domains-plans-tab";
import { TurbovdsPlansTab } from "./turbovds-plans-tab";
import type { VpsPlan } from "@/lib/vps-plans";
import { BULLETPROOF_VPS_OS_OPTIONS } from "@/lib/vps-os-options";
import { BULLETPROOF_DEDICATED_PLANS } from "@/lib/bulletproof-dedicated-plans";
import { STANDARD_DEDICATED_PLANS } from "@/lib/dedicated-plans";
import {
  PLAN_PRODUCT_LINES_VISIBLE,
  parsePlanTab,
  getPlanProductLine,
  type PlanTab,
} from "@/lib/plan-catalog";
import type { VpsPlan } from "@/lib/vps-plans";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

interface Location {
  id: string;
  name: string;
  code: string;
  country: string;
  city?: string | null;
}

type InventoryItem = {
  id: string;
  name: string;
  cpu: string;
  stockAvail: number;
  lowStockAt: number;
  monthlyPrice: unknown;
};

interface PlansHubProps {
  defaultTab: PlanTab;
  locations: Location[];
  bulletproofVpsPlans: readonly VpsPlan[];
  standardVpsPlans: readonly VpsPlan[];
  turboPlans: readonly VpsPlan[];
  inventory: InventoryItem[];
}

export type { PlanTab } from "@/lib/plan-catalog";

export function PlansHub({
  defaultTab,
  locations,
  bulletproofVpsPlans,
  standardVpsPlans,
  turboPlans,
  inventory,
}: PlansHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<PlanTab>(defaultTab);

  useEffect(() => {
    setTab(parsePlanTab(searchParams.get("tab")));
  }, [searchParams]);

  const setTabAndUrl = useCallback(
    (next: PlanTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/plans?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const product = getPlanProductLine(tab);

  return (
    <div className="space-y-6">
      <PlanProductNav lines={PLAN_PRODUCT_LINES_VISIBLE} value={tab} onChange={setTabAndUrl} />

      {tab !== "bulletproof-vps" &&
        tab !== "bulletproof-domains" &&
        tab !== "bulletproof-dedicated" &&
        tab !== "vps" &&
        tab !== "dedicated" &&
        tab !== "turbovds" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/6 pb-4">
          <h2 className="text-lg font-semibold tracking-tight">{product.label}</h2>
          {product.bulletproof && (
            <Badge variant="muted" className="gap-1">
              <Shield className="h-3 w-3" strokeWidth={1.5} />
              Bulletproof
            </Badge>
          )}
        </div>
      )}

      <div role="tabpanel">
        {tab === "bulletproof-domains" && (
          <DomainsPlansTab
            bulletproof
            title="Bulletproof Domains & Offshore Registration"
            description="DMCA-ignored registration with manual abuse review and offshore DNS."
          />
        )}
        {tab === "bulletproof-vps" && (
          <VpsPlansTab
            locations={locations}
            plans={bulletproofVpsPlans}
            title="Bulletproof VPS/VDS Hosting"
            description="Offshore VPS/VDS with DMCA-ignored policies and instant delivery"
            deployLabel="Deploy VPS"
            panelTitle="Instant delivery"
            detailedCatalog
            osOptions={BULLETPROOF_VPS_OS_OPTIONS}
            filterLocationsByPlan
          />
        )}
        {tab === "bulletproof-dedicated" && (
          <DedicatedPlansTab
            inventory={inventory}
            bulletproof
            title="Bulletproof Dedicated Servers"
            catalog={BULLETPROOF_DEDICATED_PLANS}
            detailedCatalog
            description="Bare-metal servers under bulletproof policy — high-trust workloads and DMCA-ignored hosting."
          />
        )}
        {tab === "vps" && (
          <VpsPlansTab
            locations={locations}
            plans={standardVpsPlans}
            title="VPS/VDS Hosting"
            description="Standard virtual servers — pick a plan, region, and deploy instantly."
            deployLabel="Deploy VPS"
            panelTitle="Deploy configuration"
          />
        )}
        {tab === "dedicated" && (
          <DedicatedPlansTab
            inventory={inventory}
            title="Dedicated Servers"
            catalog={STANDARD_DEDICATED_PLANS}
            description="Standard bare-metal servers with fixed configs, SLA-backed performance, and DDoS-ready uplinks."
          />
        )}
        {tab === "turbovds" && <TurbovdsPlansTab locations={locations} plans={turboPlans} />}
      </div>
    </div>
  );
}
