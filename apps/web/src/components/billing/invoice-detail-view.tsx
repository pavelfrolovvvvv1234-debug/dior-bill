"use client";

import { useTransition } from "react";
import { FastLink } from "@/components/ui/fast-link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/enterprise/panel";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { payInvoiceAction, downloadInvoiceAction } from "@/app/actions/invoice";
import { formatLocalDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/utils";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { useI18n } from "@/lib/i18n/store";
import { ArrowLeft, Download, Wallet } from "lucide-react";

interface InvoiceDetailViewProps {
  invoice: {
    id: string;
    number: string;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    remaining: number;
    dueAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    notes: string | null;
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      serviceLabel?: string;
    }>;
  };
}

export function InvoiceDetailView({ invoice }: InvoiceDetailViewProps) {
  const { t, locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const canPay =
    invoice.remaining > 0 &&
    (invoice.status === "PENDING" ||
      invoice.status === "PARTIAL" ||
      invoice.status === "OVERDUE");

  function handlePay() {
    startTransition(async () => {
      await payInvoiceAction(invoice.id);
    });
  }

  function handleDownload() {
    startTransition(async () => {
      const text = await downloadInvoiceAction(invoice.id);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.number}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 -ml-2" asChild>
        <FastLink href="/billing">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("breadcrumbs.billing")}
        </FastLink>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{invoice.number}</h1>
          <p className="mt-1 text-sm text-muted-foreground"><LocalDateTime value={invoice.createdAt} /></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleDownload} disabled={pending}>
            <Download className="h-3.5 w-3.5" />
            {t("common.export")}
          </Button>
          {canPay && (
            <Button size="sm" className="h-8 gap-1.5" onClick={handlePay} disabled={pending}>
              <Wallet className="h-3.5 w-3.5" />
              {t("billing.invoiceDetail.payAmount", { amount: formatMoney(invoice.remaining) })}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("common.status"), value: <InvoiceStatusBadge status={invoice.status} /> },
          { label: t("common.amount"), value: formatMoney(invoice.total) },
          { label: t("billing.invoiceDetail.paid"), value: formatMoney(invoice.amountPaid) },
          { label: t("billing.invoiceDetail.due"), value: invoice.dueAt ? <LocalDateTime value={invoice.dueAt} mode="date" /> : "—" },
        ].map((k) => (
          <div key={String(k.label)} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <div className="mt-1 text-lg font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      <Panel title={t("billing.invoices.title")} noPadding>
        <ul className="divide-y divide-border">
          {invoice.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{item.description}</p>
                {item.serviceLabel && (
                  <p className="text-xs text-muted-foreground">{item.serviceLabel}</p>
                )}
              </div>
              <div className="text-right font-mono text-xs tabular-nums">
                <p>
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </p>
                <p className="font-semibold">{formatMoney(item.total)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("billing.invoiceDetail.subtotal")}</span>
            <span className="font-mono tabular-nums">{formatMoney(invoice.subtotal)}</span>
          </div>
          {invoice.tax > 0 && (
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">{t("billing.invoiceDetail.tax")}</span>
              <span className="font-mono tabular-nums">{formatMoney(invoice.tax)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between font-semibold">
            <span>{t("billing.invoiceDetail.total")}</span>
            <span className="font-mono tabular-nums">{formatMoney(invoice.total)}</span>
          </div>
          {invoice.remaining > 0 && (
            <div className="mt-1 flex justify-between text-primary">
              <span>{t("billing.invoiceDetail.balanceDue")}</span>
              <span className="font-mono tabular-nums">{formatMoney(invoice.remaining)}</span>
            </div>
          )}
        </div>
      </Panel>

      {invoice.notes && (
        <Panel title={t("billing.invoiceDetail.notes")}>
          <p className="text-sm text-muted-foreground">{invoice.notes}</p>
        </Panel>
      )}

      {invoice.paidAt && (
        <p className="text-sm text-muted-foreground">
          {t("billing.invoiceDetail.paidOn", {
            date: formatLocalDateTime(invoice.paidAt, { locale }),
          })}
        </p>
      )}
    </div>
  );
}
