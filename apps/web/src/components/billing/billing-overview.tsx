"use client";

import { FastLink } from "@/components/ui/fast-link";
import { useI18n } from "@/lib/i18n/store";
import { Plus, ArrowRight, History, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/enterprise/panel";
import { KpiCard } from "@/components/ui/enterprise/kpi-card";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/ui/enterprise/data-table";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { RecentLedgerCard, InvoiceCard } from "./billing-mobile-cards";
import { formatMoney, formatDate } from "@/lib/utils";

interface Wallet {
  available: number;
  locked: number;
  credits: number;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: unknown;
  createdAt: Date;
}

interface Transaction {
  id: string;
  description: string;
  type: string;
  amount: unknown;
  createdAt: Date;
}

interface BillingOverviewProps {
  wallet: Wallet;
  invoices: Invoice[];
  transactions: Transaction[];
}

export function BillingOverview({ wallet, invoices, transactions }: BillingOverviewProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("billing.availableBalance")}
          value={formatMoney(wallet.available)}
          icon={Wallet}
          href="/billing/topup"
        />
        <KpiCard
          label={t("billing.lockedFunds")}
          value={formatMoney(wallet.locked)}
          hint={wallet.locked > 0 ? t("billing.lockedHint") : undefined}
        />
        <KpiCard label={t("billing.accountCredits")} value={formatMoney(wallet.credits)} />
        <KpiCard
          label={t("billing.openInvoices")}
          value={String(invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").length)}
          hint={t("billing.totalCount", { count: invoices.length })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title={t("billing.wallet.title")}
          description={t("billing.wallet.description")}
          className="lg:col-span-1"
          action={
            <Button size="sm" className="h-8" asChild>
              <FastLink href="/billing/topup">
                <Plus className="h-3.5 w-3.5" />
                {t("common.addFunds")}
              </FastLink>
            </Button>
          }
        >
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(wallet.available)}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("billing.wallet.body")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8" asChild>
              <FastLink href="/billing/transactions">
                <History className="mr-1.5 h-3.5 w-3.5" />
                {t("billing.wallet.transactions")}
              </FastLink>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
              <FastLink href="/billing/topup">
                {t("billing.wallet.paymentCenter")}
                <ArrowRight className="h-3.5 w-3.5" />
              </FastLink>
            </Button>
          </div>
        </Panel>

        <Panel
          title={t("billing.ledger.title")}
          description={t("billing.ledger.description")}
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" className="h-8" asChild>
              <FastLink href="/billing/transactions">{t("common.viewAll")}</FastLink>
            </Button>
          }
          noPadding
        >
          <div className="space-y-3 p-4 md:hidden">
            {transactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("billing.ledger.empty")}</p>
            ) : (
              transactions.slice(0, 8).map((tx) => (
                <RecentLedgerCard
                  key={tx.id}
                  description={tx.description}
                  createdAt={tx.createdAt}
                  type={tx.type}
                  amount={Number(tx.amount)}
                />
              ))
            )}
          </div>
          <div className="hidden md:block">
            <DataTable minWidth={320}>
              <DataTableHead>
                <DataTableTh>{t("common.description")}</DataTableTh>
                <DataTableTh align="right">{t("common.amount")}</DataTableTh>
              </DataTableHead>
              <DataTableBody>
                {transactions.length === 0 ? (
                  <DataTableEmpty message={t("billing.ledger.empty")} colSpan={2} />
                ) : (
                  transactions.slice(0, 8).map((tx) => (
                    <DataTableRow key={tx.id}>
                      <DataTableTd>
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                      </DataTableTd>
                      <DataTableTd align="right" mono>
                        <span className={tx.type === "CREDIT" ? "text-success" : ""}>
                          {tx.type === "CREDIT" ? "+" : "−"}
                          {formatMoney(Number(tx.amount))}
                        </span>
                      </DataTableTd>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </div>
        </Panel>
      </div>

      <Panel
        title={t("billing.invoices.title")}
        description={t("billing.invoices.description")}
        action={
          <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled>
            <FileText className="h-3.5 w-3.5" />
            {t("common.export")}
          </Button>
        }
        noPadding
      >
        <div className="space-y-3 p-4 md:hidden">
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("billing.invoices.empty")}</p>
          ) : (
            invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                number={inv.number}
                createdAt={inv.createdAt}
                status={inv.status}
                total={Number(inv.total)}
              />
            ))
          )}
        </div>
        <div className="hidden md:block">
          <DataTable>
            <DataTableHead>
              <DataTableTh>{t("common.invoice")}</DataTableTh>
              <DataTableTh>{t("common.date")}</DataTableTh>
              <DataTableTh>{t("common.status")}</DataTableTh>
              <DataTableTh align="right">{t("common.amount")}</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {invoices.length === 0 ? (
                <DataTableEmpty message={t("billing.invoices.empty")} colSpan={4} />
              ) : (
                invoices.map((inv) => (
                  <DataTableRow key={inv.id}>
                    <DataTableTd mono>{inv.number}</DataTableTd>
                    <DataTableTd className="text-muted-foreground">{formatDate(inv.createdAt)}</DataTableTd>
                    <DataTableTd>
                      <InvoiceStatusBadge status={inv.status} />
                    </DataTableTd>
                    <DataTableTd align="right" mono>
                      {formatMoney(Number(inv.total))}
                    </DataTableTd>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </div>
      </Panel>
    </div>
  );
}
