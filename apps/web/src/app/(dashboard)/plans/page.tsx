import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { getDedicatedInventory, getLocations, getWallet } from "@dior/backend";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { PlansHub } from "@/components/plans/plans-hub";
import { parsePlanTab } from "@/lib/plan-catalog";
import { VPS_PLANS, STANDARD_VPS_PLANS, TURBO_VPS_PLANS } from "@/lib/vps-plans";
import {
  BULLETPROOF_VPS_OS_OPTIONS,
  STANDARD_VPS_OS_OPTIONS,
  type VpsOsOption,
} from "@/lib/vps-os-options";
import { filterOsOptionsByTemplateMap } from "@dior/backend";

export default async function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { tab: tabParam } = await searchParams;
  const defaultTab = parsePlanTab(tabParam);

  const [locations, inventory, wallet] = await Promise.all([
    getLocations(),
    getDedicatedInventory(),
    getWallet(session.user.id),
  ]);

  const bulletproofOsOptions = filterOsOptionsByTemplateMap([
    ...BULLETPROOF_VPS_OS_OPTIONS,
  ]) as VpsOsOption[];
  const standardOsOptions = filterOsOptionsByTemplateMap([
    ...STANDARD_VPS_OS_OPTIONS,
  ]) as VpsOsOption[];
  const fallbackOs: VpsOsOption[] = [{ value: "debian-12", label: "Debian 12" }];

  return (
    <>
      <I18nPageHeader
        titleKey="pages.plans.title"
        descriptionKey="pages.plans.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.overview", href: "/dashboard" },
          { labelKey: "nav.selectPlan" },
        ]}
      />
      <PageContainer>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading plans…</p>}>
          <PlansHub
            defaultTab={defaultTab}
            locations={locations}
            bulletproofVpsPlans={VPS_PLANS}
            standardVpsPlans={STANDARD_VPS_PLANS}
            turboPlans={TURBO_VPS_PLANS}
            inventory={inventory}
            spendableBalance={wallet.spendable}
            bulletproofOsOptions={
              bulletproofOsOptions.length ? bulletproofOsOptions : fallbackOs
            }
            standardOsOptions={
              standardOsOptions.length ? standardOsOptions : fallbackOs
            }
          />
        </Suspense>
      </PageContainer>
    </>
  );
}
