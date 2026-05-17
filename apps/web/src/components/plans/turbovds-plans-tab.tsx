"use client";

import { VpsPlansTab } from "./vps-plans-tab";
import type { VpsPlan } from "@/lib/vps-plans";

interface Location {
  id: string;
  name: string;
  code: string;
  country: string;
  city?: string | null;
}

export function TurbovdsPlansTab({
  locations,
  plans,
}: {
  locations: Location[];
  plans: readonly VpsPlan[];
}) {
  return (
    <VpsPlansTab
      locations={locations}
      plans={plans}
      title="TurboVDS"
      description="High-frequency DDR5 + NVMe compute with 10 Gbps uplink and unlimited bandwidth."
      deployLabel="Purchase TurboVDS"
      panelTitle="Order configuration"
      detailedCatalog
      purchaseViaTicket
    />
  );
}
