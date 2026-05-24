import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { getDedicatedInventory, getLocations } from "@dior/backend";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { PlansHub } from "@/components/plans/plans-hub";
import { parsePlanTab } from "@/lib/plan-catalog";
import { VPS_PLANS, STANDARD_VPS_PLANS, TURBO_VPS_PLANS } from "@/lib/vps-plans";

export default async function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSession();
  const { tab: tabParam } = await searchParams;
  const defaultTab = parsePlanTab(tabParam);

  const [locations, inventory] = await Promise.all([getLocations(), getDedicatedInventory()]);

  return (
    <>
      <PageHeader
        title="Select Plan"
        description="Bulletproof & standard infrastructure — domains, VPS, dedicated, and Turbovds"
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Select Plan" }]}
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
          />
        </Suspense>
      </PageContainer>
    </>
  );
}
