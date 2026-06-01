import { getControlDashboard } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { requireControlSession } from "@/lib/auth";
import { DashboardOverview } from "./dashboard-overview";

export default async function ControlDashboardPage() {
  const actor = await requireControlSession();
  const data = await getControlDashboard(actor.id);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Top-ups, users, services, and support at a glance"
      />
      <PageContainer>
        <DashboardOverview data={data} />
      </PageContainer>
    </>
  );
}
