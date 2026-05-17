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
import { requireControlSession } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

export default async function ReferralsPage() {
  const actor = await requireControlSession();
  const [overview, payouts] = await Promise.all([
    getReferralOverview(actor.id),
    listPayoutRequests(actor.id, { status: "PENDING" }),
  ]);

  return (
    <>
      <PageHeader title="Referrals" description="Affiliate program, payouts, VIP tiers" />
      <PageContainer>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Total earnings" value={formatMoney(overview.totalEarnings)} />
          <KpiCard label="Pending payouts" value={String(overview.pendingPayouts)} />
          <KpiCard label="VIP affiliates" value={String(overview.vipAffiliates)} />
        </div>
        <Panel title="Payout queue" noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>User</DataTableTh>
              <DataTableTh>Amount</DataTableTh>
              <DataTableTh>Method</DataTableTh>
              <DataTableTh>Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {payouts.items.map((p) => (
                <DataTableRow key={p.id}>
                  <DataTableTd>{p.user.email}</DataTableTd>
                  <DataTableTd mono>{formatMoney(Number(p.amount))}</DataTableTd>
                  <DataTableTd>{p.method}</DataTableTd>
                  <DataTableTd><PayoutActions payoutId={p.id} /></DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Panel>
      </PageContainer>
    </>
  );
}
