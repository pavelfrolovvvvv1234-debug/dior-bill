import { PageHeaderSkeleton } from "@/components/ui/enterprise/page-skeleton";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionsTableSkeleton } from "@/components/billing/billing-skeletons";

export default function TransactionsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContainer>
        <TransactionsTableSkeleton />
      </PageContainer>
    </>
  );
}
