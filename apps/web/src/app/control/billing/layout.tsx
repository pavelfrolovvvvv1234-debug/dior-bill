import { BillingSubNav } from "@/components/control/billing/billing-sub-nav";
import { PageContainer } from "@/components/control/page-container";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer className="space-y-6">
      <BillingSubNav />
      {children}
    </PageContainer>
  );
}
