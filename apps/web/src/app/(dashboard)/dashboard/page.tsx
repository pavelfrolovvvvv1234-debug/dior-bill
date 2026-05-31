import { requireSession } from "@/lib/auth";
import { getDashboardStats, getUserServices } from "@dior/backend";
import { DashboardContent } from "./dashboard-content";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [stats, services] = await Promise.all([
    getDashboardStats(userId),
    getUserServices(userId),
  ]);

  return (
    <>
      <I18nPageHeader
        titleKey="pages.dashboard.title"
        descriptionKey="pages.dashboard.description"
      />
      <PageContainer>
        <DashboardContent stats={stats} services={services} />
      </PageContainer>
    </>
  );
}
