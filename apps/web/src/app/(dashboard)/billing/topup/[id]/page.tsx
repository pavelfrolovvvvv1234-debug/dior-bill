import { Suspense } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { TopUpDetailSection } from "@/components/billing/topup-detail-section";
import { TopUpDetailSkeleton } from "@/components/billing/billing-skeletons";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function TopUpStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        title="Payment status"
        description="Track your top-up and payment confirmation"
        breadcrumbs={[
          { label: "Billing", href: "/billing" },
          { label: "Add funds", href: "/billing/topup" },
          { label: "Status" },
        ]}
      />
      <PageContainer className="max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 h-8" asChild>
          <FastLink href="/billing/topup">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Top-up
          </FastLink>
        </Button>
        <Suspense fallback={<TopUpDetailSkeleton />}>
          <TopUpDetailSection id={id} />
        </Suspense>
      </PageContainer>
    </>
  );
}
