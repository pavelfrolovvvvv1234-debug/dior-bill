import { requireSession } from "@/lib/auth";
import { getDashboardStats, getUserServices } from "@dior/backend";
import {
  getInfrastructureFeed,
  getUserNotifications,
  getReferralDashboard,
  getUserActivityFeed,
  getInfrastructureStatus,
} from "@dior/backend";
import { DashboardContent } from "./dashboard-content";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [stats, services, feed, notifications, referrals, activity, infraStatus] =
    await Promise.all([
      getDashboardStats(userId),
      getUserServices(userId),
      getInfrastructureFeed(1, 5),
      getUserNotifications(userId, false, 1, 5),
      getReferralDashboard(userId).catch(() => null),
      getUserActivityFeed(userId, 12),
      getInfrastructureStatus(),
    ]);

  return (
    <>
      <I18nPageHeader
        titleKey="pages.dashboard.title"
        descriptionKey="pages.dashboard.description"
      />
      <PageContainer>
        <DashboardContent
          stats={stats}
          services={services}
          feed={feed.items}
          notifications={notifications.items}
          referralEarnings={referrals?.totalEarnings ?? stats.referralEarnings}
          activity={activity}
          infraStatus={infraStatus}
        />
      </PageContainer>
    </>
  );
}
