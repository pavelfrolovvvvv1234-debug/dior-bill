import Link from "next/link";
import { listAdminTopUps } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { AdminPaymentsClient } from "@/components/control/payments-client";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; manual?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const data = await listAdminTopUps(actor.id, {
    page: 1,
    pageSize: 50,
    manualOnly: params.manual === "true",
    status: params.status as import("@dior/database").TopUpStatus | undefined,
  });

  return (
    <>
      <PageHeader
        title="Payments"
        description="Top-ups, gateways, manual review queue"
        actions={
          <Link href={`${controlPath("/payments")}?manual=true`} className="text-xs text-primary">
            Manual queue
          </Link>
        }
      />
      <PageContainer>
        <AdminPaymentsClient initial={data} adminId={actor.id} />
      </PageContainer>
    </>
  );
}
