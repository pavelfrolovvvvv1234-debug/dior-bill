import Link from "next/link";
import { getAdminInvoiceDetail } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { Panel } from "@/components/control/panel";
import { InvoiceActions } from "@/components/control/billing/invoice-actions";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatDate, formatMoney } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireControlSession();

  let invoice;
  try {
    invoice = await getAdminInvoiceDetail(actor.id, id);
  } catch {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={invoice.number}
        description={`Invoice for ${invoice.user.email ?? invoice.user.id}`}
        actions={<InvoiceActions invoiceId={invoice.id} status={invoice.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total", value: formatMoney(invoice.total) },
          { label: "Paid", value: formatMoney(invoice.amountPaid) },
          { label: "Status", value: invoice.status },
          { label: "Due", value: invoice.dueAt ? formatDate(invoice.dueAt) : "—" },
        ].map((k) => (
          <div key={k.label} className="panel p-4">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{k.label}</p>
            <p className="mt-1 text-lg font-semibold">{k.label === "Status" ? <BillingStatusBadge status={k.value} /> : k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Line items">
          <ul className="space-y-3 text-sm">
            {invoice.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 border-b border-white/6 pb-3 last:border-0">
                <div>
                  <p className="font-medium">{item.description}</p>
                  {item.service && (
                    <Link href={controlPath(`/services/${item.service.id}`)} className="text-xs text-primary">
                      {item.service.label}
                    </Link>
                  )}
                </div>
                <div className="text-right font-mono text-xs tabular-nums">
                  <p>{item.quantity} × {formatMoney(item.unitPrice)}</p>
                  <p className="font-semibold">{formatMoney(item.total)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Customer">
          <dl className="space-y-2 text-sm">
            <Row label="Email" value={invoice.user.email ?? "—"} />
            <Row label="Balance" value={formatMoney(invoice.user.balance)} />
            <Row label="Created" value={formatDate(invoice.createdAt)} />
            {invoice.notes && <Row label="Notes" value={invoice.notes} />}
          </dl>
          <Link href={controlPath(`/users/${invoice.user.id}`)} className="mt-4 inline-block text-xs text-primary">
            Open customer profile →
          </Link>
        </Panel>
      </div>

      <Panel title="Related transactions">
        <ul className="space-y-2 text-sm">
          {invoice.transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3">
              <span>{tx.type} — {tx.description}</span>
              <span className="font-mono tabular-nums">{formatMoney(tx.amount)}</span>
            </li>
          ))}
          {invoice.transactions.length === 0 && (
            <p className="text-[var(--muted-foreground)]">No linked transactions</p>
          )}
        </ul>
      </Panel>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
