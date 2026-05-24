import { requireSession } from "@/lib/auth";
import { getUserLedgerCached } from "@/lib/billing-data";
import { TransactionsView } from "@/components/billing/transactions-view";

export async function TransactionsSection({
  page,
  search,
}: {
  page: number;
  search?: string;
}) {
  const session = await requireSession();
  const ledger = await getUserLedgerCached(session.user.id, page, search);

  return (
    <TransactionsView
      items={ledger.items}
      page={page}
      totalPages={ledger.totalPages}
      search={search}
    />
  );
}
