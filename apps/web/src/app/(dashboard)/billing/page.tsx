import { Suspense } from "react";
import { PageHeader } from "@/components/ui/enterprise/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { BillingOverviewSection } from "@/components/billing/billing-overview-section";
import { BillingOverviewSkeleton } from "@/components/billing/billing-skeletons";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing"
        description="Wallet, invoices, subscriptions, and payment audit trail"
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Billing" }]}
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
        <Suspense fallback={<BillingOverviewSkeleton />}>
          <BillingOverviewSection />
        </Suspense>
      </PageContainer>
    </>
  );
}
