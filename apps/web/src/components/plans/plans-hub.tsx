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
import { STANDARD_VPS_COUNTRY_CODES } from "@/lib/vps-plan-locations";
import { BULLETPROOF_DEDICATED_PLANS } from "@/lib/bulletproof-dedicated-plans";
import { STANDARD_DEDICATED_PLANS } from "@/lib/dedicated-plans";
import { parsePlanTab, getPlanProductLine, type PlanTab } from "@/lib/plan-catalog";
import { usePlanProductLines } from "@/lib/i18n/use-plan-lines";
import { useI18n } from "@/lib/i18n/store";
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
  spendableBalance: number;
}

export type { PlanTab } from "@/lib/plan-catalog";

export function PlansHub({
  defaultTab,
  locations,
  bulletproofVpsPlans,
  standardVpsPlans,
  turboPlans,
  inventory,
  spendableBalance,
}: PlansHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const productLines = usePlanProductLines();
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
      <PlanProductNav lines={productLines} value={tab} onChange={setTabAndUrl} />

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
              {t("common.bulletproof")}
            </Badge>
          )}
        </div>
      )}

      <div role="tabpanel">
        {tab === "bulletproof-domains" && (
          <DomainsPlansTab
            bulletproof
            title={t("plans.bpDomainsTitle")}
            description={t("plans.bpDomainsDesc")}
            spendableBalance={spendableBalance}
          />
        )}
        {tab === "bulletproof-vps" && (
          <VpsPlansTab
            locations={locations}
            plans={bulletproofVpsPlans}
            title={t("plans.bpVpsTitle")}
            description={t("plans.bpVpsDesc")}
            deployLabel={t("plans.bpVpsDeploy")}
            panelTitle={t("plans.bpVpsPanel")}
            detailedCatalog
            osOptions={BULLETPROOF_VPS_OS_OPTIONS}
            filterLocationsByPlan
          />
        )}
        {tab === "bulletproof-dedicated" && (
          <DedicatedPlansTab
            inventory={inventory}
            locations={locations}
            bulletproof
            title={t("plans.bpDedicatedTitle")}
            catalog={BULLETPROOF_DEDICATED_PLANS}
            detailedCatalog
            panelTitle={t("plans.stdVpsPanel")}
            description={t("plans.bpDedicatedDesc")}
          />
        )}
        {tab === "vps" && (
          <VpsPlansTab
            locations={locations}
            plans={standardVpsPlans}
            title={t("plans.stdVpsTitle")}
            description={t("plans.stdVpsDesc")}
            deployLabel={t("plans.stdVpsDeploy")}
            panelTitle={t("plans.stdVpsPanel")}
            detailedCatalog
            osOptions={BULLETPROOF_VPS_OS_OPTIONS}
            allowedCountryCodes={STANDARD_VPS_COUNTRY_CODES}
            locationCountryLabels
            purchaseViaTicket
            ticketKind="standard-vps"
          />
        )}
        {tab === "dedicated" && (
          <DedicatedPlansTab
            inventory={inventory}
            locations={locations}
            title={t("plans.stdDedicatedTitle")}
            catalog={STANDARD_DEDICATED_PLANS}
            detailedCatalog
            panelTitle={t("plans.stdVpsPanel")}
            description={t("plans.stdDedicatedDesc")}
          />
        )}
        {tab === "turbovds" && <TurbovdsPlansTab locations={locations} plans={turboPlans} />}
      </div>
    </div>
  );
}
