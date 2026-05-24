import { Suspense } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { TopUpDetailSection } from "@/components/billing/topup-detail-section";
import { TopUpDetailSkeleton } from "@/components/billing/billing-skeletons";
import { TopUpBackLink } from "@/components/billing/topup-back-link";

export default async function TopUpStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <I18nPageHeader
        titleKey="pages.paymentStatus.title"
        descriptionKey="pages.paymentStatus.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.billing", href: "/billing" },
          { labelKey: "breadcrumbs.addFunds", href: "/billing/topup" },
          { labelKey: "breadcrumbs.paymentStatus" },
        ]}
      />
      <PageContainer className="max-w-3xl">
        <TopUpBackLink />
        <Suspense fallback={<TopUpDetailSkeleton />}>
          <TopUpDetailSection id={id} />
        </Suspense>
      </PageContainer>
    </>
  );
}
