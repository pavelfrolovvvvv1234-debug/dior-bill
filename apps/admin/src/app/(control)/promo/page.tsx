import { listPromoCodes } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { PromoCreateForm } from "@/components/control/promo-create-form";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";

export default async function PromoPage() {
  const actor = await requireControlSession();
  const data = await listPromoCodes(actor.id);

  return (
    <>
      <PageHeader title="Promo codes" description="Discount campaigns and usage limits" />
      <PageContainer>
        <PromoCreateForm />
        <Panel title="Active codes" noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>Code</DataTableTh>
              <DataTableTh>Type</DataTableTh>
              <DataTableTh>Uses</DataTableTh>
              <DataTableTh>Status</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No promo codes" colSpan={4} />
              ) : (
                data.items.map((p) => (
                  <DataTableRow key={p.id}>
                    <DataTableTd mono className="font-medium">{p.code}</DataTableTd>
                    <DataTableTd>{p.discountType} / {Number(p.discountValue)}</DataTableTd>
                    <DataTableTd>{p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ""}</DataTableTd>
                    <DataTableTd><Badge variant={p.active ? "success" : "warning"}>{p.active ? "Active" : "Off"}</Badge></DataTableTd>
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
