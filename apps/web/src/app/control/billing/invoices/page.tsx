import Link from "next/link";
import { listAdminInvoices } from "@dior/backend";
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
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const data = await listAdminInvoices(actor.id, {
    status: params.status as import("@dior/database").InvoiceStatus | undefined,
    q: params.q,
    page: Number(params.page ?? 1),
  });

  return (
    <>
      <PageHeader title="Invoices" description="Lifecycle control — mark paid, void, extend due dates" />
      <form method="get" className="flex flex-wrap gap-3">
        <Input name="q" placeholder="Search invoice # or email…" defaultValue={params.q} className="max-w-sm" />
        <div className="flex flex-wrap gap-2 text-xs">
          {["PENDING", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
            <Link
              key={s}
              href={`${controlPath("/billing/invoices")}?status=${s}`}
              className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"
            >
              {s}
            </Link>
          ))}
        </div>
      </form>
      <Panel title={`${data.total} invoices`} noPadding>
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
                  <DataTableTd>
                    <Link href={controlPath(`/billing/invoices/${inv.id}`)} className="font-mono text-xs hover:text-primary">
                      {inv.number}
                    </Link>
                  </DataTableTd>
                  <DataTableTd>
                    <Link href={controlPath(`/users/${inv.user.id}`)} className="hover:text-primary">
                      {inv.user.email}
                    </Link>
                  </DataTableTd>
                  <DataTableTd><BillingStatusBadge status={inv.status} /></DataTableTd>
                  <DataTableTd>{inv.dueAt ? formatDate(inv.dueAt) : "—"}</DataTableTd>
                  <DataTableTd align="right" mono>{formatMoney(Number(inv.total))}</DataTableTd>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </Panel>
    </>
  );
}
