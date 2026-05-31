import { BillingSubNav } from "@/components/control/billing/billing-sub-nav";
import { BillingExportButton } from "@/components/control/billing/billing-export-button";
import { PageContainer } from "@/components/control/page-container";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BillingSubNav />
        <BillingExportButton />
      </div>
      {children}
    </PageContainer>
  );
}
