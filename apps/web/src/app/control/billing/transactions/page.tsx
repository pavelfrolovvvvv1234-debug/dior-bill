import Link from "next/link";
import { listAdminTransactions } from "@dior/backend";
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
import { formatDate, formatMoney } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const actor = await requireControlSession();
  const params = await searchParams;
  const data = await listAdminTransactions(actor.id, {
    q: params.q,
    type: params.type as import("@dior/database").TransactionType | undefined,
    page: Number(params.page ?? 1),
  });

  return (
    <>
      <PageHeader title="Ledger" description="Global transaction explorer across all customers" />
      <form method="get" className="flex flex-wrap gap-3">
        <Input name="q" placeholder="Search user, description, ID…" defaultValue={params.q} className="max-w-sm" />
        <div className="flex flex-wrap gap-2 text-xs">
          {["CREDIT", "DEBIT", "PAYMENT", "REFUND", "REFERRAL", "ADJUSTMENT"].map((t) => (
            <Link
              key={t}
              href={`${controlPath("/billing/transactions")}?type=${t}`}
              className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"
            >
              {t}
            </Link>
          ))}
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {data.typeStats.map((s) => (
          <div key={s.type} className="panel p-3">
            <BillingStatusBadge status={s.type} />
            <p className="mt-2 font-mono text-sm tabular-nums">{s.count} · {formatMoney(s.volume)}</p>
          </div>
        ))}
      </div>

      <Panel title={`${data.total} transactions`} noPadding>
        <DataTable>
          <DataTableHead>
            <DataTableTh>Type</DataTableTh>
            <DataTableTh>Customer</DataTableTh>
            <DataTableTh>Description</DataTableTh>
            <DataTableTh>Invoice</DataTableTh>
            <DataTableTh align="right">Amount</DataTableTh>
            <DataTableTh>Date</DataTableTh>
          </DataTableHead>
          <DataTableBody>
            {data.items.length === 0 ? (
              <DataTableEmpty message="No transactions" colSpan={6} />
            ) : (
              data.items.map((tx) => (
                <DataTableRow key={tx.id}>
                  <DataTableTd><BillingStatusBadge status={tx.type} /></DataTableTd>
                  <DataTableTd>
                    <Link href={controlPath(`/users/${tx.user.id}`)} className="hover:text-primary">
                      {tx.user.email ?? tx.user.id.slice(0, 8)}
                    </Link>
                  </DataTableTd>
                  <DataTableTd className="max-w-[240px] truncate">{tx.description}</DataTableTd>
                  <DataTableTd>
                    {tx.invoice ? (
                      <Link href={controlPath(`/billing/invoices/${tx.invoice.id}`)} className="font-mono text-xs hover:text-primary">
                        {tx.invoice.number}
                      </Link>
                    ) : "—"}
                  </DataTableTd>
                  <DataTableTd align="right" mono>{formatMoney(tx.amount)}</DataTableTd>
                  <DataTableTd className="text-[var(--muted-foreground)]">{formatDate(tx.createdAt)}</DataTableTd>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </Panel>
    </>
  );
}
