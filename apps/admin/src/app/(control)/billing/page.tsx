import Link from "next/link";
import { listAdminInvoices } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
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
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";
import { formatMoney, formatDate } from "@/lib/utils";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const data = await listAdminInvoices(actor.id, {
    status: params.status as import("@dior/database").InvoiceStatus | undefined,
    page: Number(params.page ?? 1),
  });

  return (
    <>
      <PageHeader title="Billing" description="Invoices, overrides, refunds" />
      <PageContainer>
        <div className="flex flex-wrap gap-2 text-xs">
          {["PENDING", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
            <Link key={s} href={`/billing?status=${s}`} className="rounded border border-white/10 px-2 py-1 hover:bg-white/5">
              {s}
            </Link>
          ))}
        </div>
        <Panel title="Invoices" noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>Invoice</DataTableTh>
              <DataTableTh>Customer</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh>Due</DataTableTh>
              <DataTableTh align="right">Total</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No invoices" colSpan={5} />
              ) : (
                data.items.map((inv) => (
                  <DataTableRow key={inv.id}>
                    <DataTableTd mono>{inv.number}</DataTableTd>
                    <DataTableTd>{inv.user.email}</DataTableTd>
                    <DataTableTd><Badge>{inv.status}</Badge></DataTableTd>
                    <DataTableTd>{inv.dueAt ? formatDate(inv.dueAt) : "—"}</DataTableTd>
                    <DataTableTd align="right" mono>{formatMoney(Number(inv.total))}</DataTableTd>
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
