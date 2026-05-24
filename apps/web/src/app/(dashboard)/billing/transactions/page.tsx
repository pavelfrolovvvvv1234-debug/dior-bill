import { Suspense } from "react";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { TransactionsSection } from "@/components/billing/transactions-section";
import { TransactionsTableSkeleton } from "@/components/billing/billing-skeletons";
import { AddFundsHeaderAction } from "@/components/billing/add-funds-header-action";

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
      <I18nPageHeader
        titleKey="pages.transactions.title"
        descriptionKey="pages.transactions.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.billing", href: "/billing" },
          { labelKey: "breadcrumbs.transactions" },
        ]}
        actions={<AddFundsHeaderAction />}
      />
      <PageContainer>
        <Suspense key={`${page}-${search ?? ""}`} fallback={<TransactionsTableSkeleton />}>
          <TransactionsSection page={page} search={search} />
        </Suspense>
      </PageContainer>
    </>
  );
}
