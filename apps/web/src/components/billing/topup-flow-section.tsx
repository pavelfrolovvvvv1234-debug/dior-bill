import { requireSession } from "@/lib/auth";
import { getWalletCached } from "@/lib/billing-data";
import { TopUpFlow } from "@/components/billing/topup-flow";

export async function TopUpFlowSection() {
  const session = await requireSession();
  const wallet = await getWalletCached(session.user.id);

  return (
    <TopUpFlow availableBalance={wallet.available} lockedBalance={wallet.locked} />
  );
}
