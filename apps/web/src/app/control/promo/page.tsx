import Link from "next/link";
import { listPromoCodes } from "@dior/backend";
import { formatPromoValue } from "@dior/shared";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { PromoCreateForm } from "@/components/control/promo-create-form";
import { PromoRowActions } from "@/components/control/billing/promo-row-actions";
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
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";

export default async function PromoPage() {
  const actor = await requireControlSession();
  const data = await listPromoCodes(actor.id);

  return (
    <>
      <PageHeader title="Promo codes" description="Campaigns, redemptions, and discount controls" />
      <PageContainer>
        <PromoCreateForm />
        <Panel title="All codes" noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>Code</DataTableTh>
              <DataTableTh>Type</DataTableTh>
              <DataTableTh>Uses</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">Actions</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No promo codes" colSpan={5} />
              ) : (
                data.items.map((p) => (
                  <DataTableRow key={p.id}>
                    <DataTableTd>
                      <Link href={controlPath(`/promo/${p.id}`)} className="font-mono font-medium hover:text-primary">
                        {p.code}
                      </Link>
                    </DataTableTd>
                    <DataTableTd>{formatPromoValue(p.discountType, Number(p.discountValue))}</DataTableTd>
                    <DataTableTd>{p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ""}</DataTableTd>
                    <DataTableTd>
                      <BillingStatusBadge status={p.active ? "ACTIVE" : "CANCELLED"} />
                    </DataTableTd>
                    <DataTableTd align="right">
                      <PromoRowActions id={p.id} active={p.active} />
                    </DataTableTd>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </Panel>
      </PageContainer>
    </>
  );
}
