import { Suspense } from "react";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { BillingOverviewSection } from "@/components/billing/billing-overview-section";
import { BillingOverviewSkeleton } from "@/components/billing/billing-skeletons";
import { AddFundsHeaderAction } from "@/components/billing/add-funds-header-action";

export default function BillingPage() {
  return (
    <>
      <I18nPageHeader
        titleKey="pages.billing.title"
        descriptionKey="pages.billing.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.overview", href: "/dashboard" },
          { labelKey: "breadcrumbs.billing" },
        ]}
        actions={<AddFundsHeaderAction />}
      />
      <PageContainer>
        <Suspense fallback={<BillingOverviewSkeleton />}>
          <BillingOverviewSection />
        </Suspense>
      </PageContainer>
    </>
  );
}
