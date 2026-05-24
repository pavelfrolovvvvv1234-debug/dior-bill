import { Suspense } from "react";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { TopUpFlowSection } from "@/components/billing/topup-flow-section";
import { TopUpFlowSkeleton } from "@/components/billing/billing-skeletons";

export default function TopUpPage() {
  return (
    <>
      <I18nPageHeader
        titleKey="pages.topup.title"
        descriptionKey="pages.topup.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.billing", href: "/billing" },
          { labelKey: "breadcrumbs.addFunds" },
        ]}
      />
      <PageContainer className="max-w-3xl">
        <Suspense fallback={<TopUpFlowSkeleton />}>
          <TopUpFlowSection />
        </Suspense>
      </PageContainer>
    </>
  );
}
