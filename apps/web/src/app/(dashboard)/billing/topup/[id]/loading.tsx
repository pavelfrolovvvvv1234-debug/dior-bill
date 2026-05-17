import { PageHeaderSkeleton } from "@/components/ui/enterprise/page-skeleton";
import { PageContainer } from "@/components/layout/page-container";
import { TopUpDetailSkeleton } from "@/components/billing/billing-skeletons";

export default function TopUpDetailLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContainer className="max-w-3xl">
        <TopUpDetailSkeleton />
      </PageContainer>
    </>
  );
}
