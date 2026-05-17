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
import { PageHeader } from "@/components/ui/enterprise/page-header";
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
      <PageHeader
        title="Overview"
        description="Infrastructure, billing, and platform health at a glance"
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
