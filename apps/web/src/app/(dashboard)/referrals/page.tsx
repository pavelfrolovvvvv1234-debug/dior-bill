import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { AffiliateDashboard } from "@/components/referrals/affiliate-dashboard";
import { requireSession } from "@/lib/auth";
import { getAffiliateTiers, getReferralDashboard } from "@dior/backend";

export default async function ReferralsPage() {
  const session = await requireSession();
  const [data, tiers] = await Promise.all([
    getReferralDashboard(session.user.id),
    getAffiliateTiers(),
  ]);

  const referralLink = data.referralLink;

  return (
    <>
      <I18nPageHeader
        titleKey="pages.referrals.title"
        descriptionKey="pages.referrals.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.overview", href: "/dashboard" },
          { labelKey: "nav.affiliate" },
        ]}
      />
      <PageContainer>
        <AffiliateDashboard
          referralCode={data.referralCode}
          referralLink={referralLink}
          tier={data.tier}
          percent={data.percent}
          totalEarnings={data.totalEarnings}
          referralCount={data.referralCount}
          referrals={data.referrals}
          recentEarnings={data.recentEarnings}
          payouts={data.payouts}
          tiers={tiers}
        />
      </PageContainer>
    </>
  );
}
