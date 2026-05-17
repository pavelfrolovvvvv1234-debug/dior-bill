import { FastLink } from "@/components/ui/fast-link";
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
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Available balance" value={formatMoney(wallet.available)} icon={Wallet} href="/billing/topup" />
        <KpiCard
          label="Locked funds"
          value={formatMoney(wallet.locked)}
          hint={wallet.locked > 0 ? "Pending provisioning or disputes" : undefined}
        />
        <KpiCard label="Account credits" value={formatMoney(wallet.credits)} />
        <KpiCard
          label="Open invoices"
          value={String(invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").length)}
          hint={`${invoices.length} total`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Wallet"
          description="Primary billing account"
          className="lg:col-span-1"
          action={
            <Button size="sm" className="h-8" asChild>
              <FastLink href="/billing/topup">
                <Plus className="h-3.5 w-3.5" />
                Add funds
              </FastLink>
            </Button>
          }
        >
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(wallet.available)}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Top up via Heleket, CryptoBot, CrystalPay, or verified manual transfer. All payments are
            logged with full audit trail and idempotency keys.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8" asChild>
              <FastLink href="/billing/transactions">
                <History className="mr-1.5 h-3.5 w-3.5" />
                Transactions
              </FastLink>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
              <FastLink href="/billing/topup">
                Payment center
                <ArrowRight className="h-3.5 w-3.5" />
              </FastLink>
            </Button>
          </div>
        </Panel>

        <Panel
          title="Recent ledger"
          description="Last 8 entries"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" className="h-8" asChild>
              <FastLink href="/billing/transactions">View all</FastLink>
            </Button>
          }
          noPadding
        >
          <DataTable>
            <DataTableHead>
              <DataTableTh>Description</DataTableTh>
              <DataTableTh align="right">Amount</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {transactions.length === 0 ? (
                <DataTableEmpty message="No transactions yet" colSpan={2} />
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
        </Panel>
      </div>

      <Panel
        title="Invoices"
        description="Sortable billing documents"
        action={
          <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled>
            <FileText className="h-3.5 w-3.5" />
            Export
          </Button>
        }
        noPadding
      >
        <DataTable>
          <DataTableHead>
            <DataTableTh>Invoice</DataTableTh>
            <DataTableTh>Date</DataTableTh>
            <DataTableTh>Status</DataTableTh>
            <DataTableTh align="right">Amount</DataTableTh>
          </DataTableHead>
          <DataTableBody>
            {invoices.length === 0 ? (
              <DataTableEmpty message="No invoices yet" colSpan={4} />
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
      </Panel>
    </div>
  );
}
