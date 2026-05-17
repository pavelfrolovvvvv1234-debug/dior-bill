import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getTopUpByIdCached } from "@/lib/billing-data";
import { TopUpDetail } from "@/components/billing/topup-detail";

export async function TopUpDetailSection({ id }: { id: string }) {
  const session = await requireSession();

  let topUp;
  try {
    topUp = await getTopUpByIdCached(id, session.user.id);
  } catch {
    notFound();
  }

  return <TopUpDetail topUp={topUp} />;
}
