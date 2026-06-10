"use client";

import { VpsPlansTab } from "./vps-plans-tab";
import type { VpsPlan } from "@/lib/vps-plans";
import { useI18n } from "@/lib/i18n/store";

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
  const { t } = useI18n();

  return (
    <VpsPlansTab
      locations={locations}
      plans={plans}
      title={t("plans.turbovds.title")}
      description={t("plans.turbovds.desc")}
      deployLabel={t("plans.buy")}
      panelTitle={t("plans.turbovds.panel")}
      detailedCatalog
      purchaseViaTicket
    />
  );
}
