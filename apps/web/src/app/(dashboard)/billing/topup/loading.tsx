import { PageHeaderSkeleton } from "@/components/ui/enterprise/page-skeleton";
import { PageContainer } from "@/components/layout/page-container";
import { TopUpFlowSkeleton } from "@/components/billing/billing-skeletons";

export default function TopUpLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContainer className="max-w-3xl">
        <TopUpFlowSkeleton />
      </PageContainer>
    </>
  );
}
