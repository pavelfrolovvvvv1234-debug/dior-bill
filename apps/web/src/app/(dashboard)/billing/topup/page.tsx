import { Suspense } from "react";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { TopUpFlowSection } from "@/components/billing/topup-flow-section";
import { TopUpFlowSkeleton } from "@/components/billing/billing-skeletons";

export default function TopUpPage() {
  return (
    <>
      <PageHeader
        title="Add funds"
        description="Secure balance top-up — enterprise payment center"
        breadcrumbs={[
          { label: "Billing", href: "/billing" },
          { label: "Add funds" },
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
