import { Suspense } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionsSection } from "@/components/billing/transactions-section";
import { TransactionsTableSkeleton } from "@/components/billing/billing-skeletons";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const search = params.q;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Payment center and ledger history"
        breadcrumbs={[
          { label: "Billing", href: "/billing" },
          { label: "Transactions" },
        ]}
        actions={
          <Button size="sm" className="h-8 gap-1.5" asChild>
            <FastLink href="/billing/topup">
              <Plus className="h-3.5 w-3.5" />
              Add funds
            </FastLink>
          </Button>
        }
      />
      <PageContainer>
        <Suspense key={`${page}-${search ?? ""}`} fallback={<TransactionsTableSkeleton />}>
          <TransactionsSection page={page} search={search} />
        </Suspense>
      </PageContainer>
    </>
  );
}
