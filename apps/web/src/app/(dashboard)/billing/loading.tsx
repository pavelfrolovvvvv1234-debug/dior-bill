import { PageHeaderSkeleton } from "@/components/ui/enterprise/page-skeleton";
import { PageContainer } from "@/components/layout/page-container";
import { BillingOverviewSkeleton } from "@/components/billing/billing-skeletons";

export default function BillingLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContainer>
        <BillingOverviewSkeleton />
      </PageContainer>
    </>
  );
}
