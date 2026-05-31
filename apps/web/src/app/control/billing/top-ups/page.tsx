import Link from "next/link";
import { listAdminTopUps } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { Panel } from "@/components/control/panel";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { TopUpStatusControl } from "@/components/control/billing/topup-status-control";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default async function TopUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; manual?: string; q?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const data = await listAdminTopUps(actor.id, {
    page: 1,
    pageSize: 50,
    manualOnly: params.manual === "true",
    status: params.status as import("@dior/database").TopUpStatus | undefined,
    search: params.q,
  });

  return (
    <>
      <PageHeader title="Top-ups" description="Payment center — approve, sync, force complete" />
      <form method="get" className="flex flex-wrap gap-3">
        <Input name="q" placeholder="Reference, email, external ID…" defaultValue={params.q} className="max-w-sm" />
        <div className="flex flex-wrap gap-2 text-xs">
          <Filter href={controlPath("/billing/top-ups")}>All</Filter>
          <Filter href={`${controlPath("/billing/top-ups")}?manual=true`}>Manual</Filter>
          <Filter href={`${controlPath("/billing/top-ups")}?status=MANUAL_REVIEW`}>Review</Filter>
          <Filter href={`${controlPath("/billing/top-ups")}?status=PAID`}>Paid</Filter>
          <Filter href={`${controlPath("/billing/top-ups")}?status=FAILED`}>Failed</Filter>
        </div>
      </form>
      <Panel title={`${data.total} top-ups`} noPadding>
        <DataTable>
          <DataTableHead>
            <DataTableTh>Reference</DataTableTh>
            <DataTableTh>Customer</DataTableTh>
            <DataTableTh>Provider</DataTableTh>
            <DataTableTh>Amount</DataTableTh>
            <DataTableTh>Status</DataTableTh>
            <DataTableTh>Created</DataTableTh>
            <DataTableTh align="right">Actions</DataTableTh>
          </DataTableHead>
          <DataTableBody>
            {data.items.length === 0 ? (
              <DataTableEmpty message="No top-ups" colSpan={7} />
            ) : (
              data.items.map((t) => (
                <DataTableRow key={t.id}>
                  <DataTableTd>
                    <Link href={controlPath(`/billing/top-ups/${t.id}`)} className="font-mono text-xs hover:text-primary">
                      {t.referenceCode}
                    </Link>
                  </DataTableTd>
                  <DataTableTd>{t.user.email ?? t.user.telegramUsername ?? "—"}</DataTableTd>
                  <DataTableTd>{t.provider}</DataTableTd>
                  <DataTableTd mono>{formatMoney(Number(t.amount))}</DataTableTd>
                  <DataTableTd><BillingStatusBadge status={t.status} /></DataTableTd>
                  <DataTableTd className="text-[var(--muted-foreground)]">{formatDate(t.createdAt)}</DataTableTd>
                  <DataTableTd align="right">
                    <TopUpStatusControl topUpId={t.id} status={t.status} compact />
                  </DataTableTd>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </Panel>
    </>
  );
}

function Filter({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5">
      {children}
    </Link>
  );
}
