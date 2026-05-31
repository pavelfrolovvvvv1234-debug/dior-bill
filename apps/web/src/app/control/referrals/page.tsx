import Link from "next/link";
import { getReferralOverview, listPayoutRequests } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { KpiCard } from "@/components/control/kpi-card";
import { Panel } from "@/components/control/panel";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { PayoutActions } from "@/components/control/payout-actions";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";

export default async function ReferralsPage() {
  const actor = await requireControlSession();
  const [overview, payouts] = await Promise.all([
    getReferralOverview(actor.id),
    listPayoutRequests(actor.id, { status: "PENDING" }),
  ]);

  return (
    <>
      <PageHeader title="Referrals" description="Affiliate earnings, payout queue, and VIP partners" />
      <PageContainer className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Total earnings" value={formatMoney(overview.totalEarnings)} />
          <KpiCard label="Pending payouts" value={String(overview.pendingPayouts)} />
          <KpiCard label="VIP affiliates" value={String(overview.vipAffiliates)} />
        </div>

        <Panel title="Top earners">
          <ul className="space-y-2 text-sm">
            {overview.topEarners.map((e) => (
              <li key={e.user?.id ?? Math.random()} className="flex items-center justify-between gap-3">
                {e.user ? (
                  <Link href={controlPath(`/users/${e.user.id}`)} className="hover:text-primary">
                    {e.user.email ?? e.user.referralCode}
                  </Link>
                ) : (
                  <span>—</span>
                )}
                <span className="font-mono tabular-nums text-primary">{formatMoney(e.earnings)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Payout queue" noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>User</DataTableTh>
              <DataTableTh>Amount</DataTableTh>
              <DataTableTh>Method</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh>Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {payouts.items.map((p) => (
                <DataTableRow key={p.id}>
                  <DataTableTd>
                    <Link href={controlPath(`/users/${p.user.id}`)} className="hover:text-primary">
                      {p.user.email}
                    </Link>
                  </DataTableTd>
                  <DataTableTd mono>{formatMoney(Number(p.amount))}</DataTableTd>
                  <DataTableTd>{p.method}</DataTableTd>
                  <DataTableTd><BillingStatusBadge status={p.status} /></DataTableTd>
                  <DataTableTd><PayoutActions payoutId={p.id} status={p.status} /></DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Panel>
      </PageContainer>
    </>
  );
}
