import { Suspense } from "react";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { InvoiceDetailSection } from "@/components/billing/invoice-detail-section";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <I18nPageHeader
        titleKey="billing.invoices.title"
        descriptionKey="billing.invoices.description"
        breadcrumbs={[
          { labelKey: "breadcrumbs.billing", href: "/billing" },
          { labelKey: "common.invoice" },
        ]}
      />
      <PageContainer className="max-w-3xl">
        <Suspense fallback={<div className="skeleton-block h-48 rounded-lg" />}>
          <InvoiceDetailSection id={id} />
        </Suspense>
      </PageContainer>
    </>
  );
}
