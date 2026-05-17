import { requireSession } from "@/lib/auth";
import { getBillingOverviewCached } from "@/lib/billing-data";
import { BillingOverview } from "@/components/billing/billing-overview";

export async function BillingOverviewSection() {
  const session = await requireSession();
  const { wallet, invoices, transactions } = await getBillingOverviewCached(session.user.id);

  return (
    <BillingOverview wallet={wallet} invoices={invoices} transactions={transactions} />
  );
}
