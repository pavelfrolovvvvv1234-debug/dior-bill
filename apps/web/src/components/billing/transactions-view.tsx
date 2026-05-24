"use client";

import { FastLink } from "@/components/ui/fast-link";
import { Panel } from "@/components/ui/enterprise/panel";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/ui/enterprise/data-table";
import { TransactionLedgerCard } from "@/components/billing/billing-mobile-cards";
import { TopUpStatusBadge } from "@/components/billing/topup-status-badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/store";
import { formatMoney, formatDate } from "@/lib/utils";

export type LedgerEntryView = {
  id: string;
  kind: "topup" | "ledger";
  provider?: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  referenceCode?: string;
  description: string;
  createdAt: Date;
};

export function TransactionsView({
  items,
  page,
  totalPages,
  search,
}: {
  items: LedgerEntryView[];
  page: number;
  totalPages: number;
  search?: string;
}) {
  const { t } = useI18n();

  return (
    <>
      <Panel
        title={t("billing.transactions.title")}
        description={t("common.pageOf", { page, total: totalPages || 1 })}
        noPadding
      >
        <div className="space-y-3 p-4 md:hidden">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("billing.transactions.empty")}
            </p>
          ) : (
            items.map((entry) => (
              <TransactionLedgerCard key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))
          )}
        </div>
        <div className="hidden md:block">
          <DataTable>
            <DataTableHead>
              <DataTableTh>{t("common.description")}</DataTableTh>
              <DataTableTh>{t("common.reference")}</DataTableTh>
              <DataTableTh>{t("common.date")}</DataTableTh>
              <DataTableTh>{t("common.status")}</DataTableTh>
              <DataTableTh align="right">{t("common.amount")}</DataTableTh>
              <DataTableTh align="right" />
            </DataTableHead>
            <DataTableBody>
              {items.length === 0 ? (
                <DataTableEmpty message={t("billing.transactions.empty")} colSpan={6} />
              ) : (
                items.map((entry) => (
                  <DataTableRow key={`${entry.kind}-${entry.id}`}>
                    <DataTableTd>
                      <p className="font-medium">{entry.description}</p>
                      {entry.provider && (
                        <p className="text-xs text-muted-foreground">{entry.provider}</p>
                      )}
                    </DataTableTd>
                    <DataTableTd mono className="text-xs text-muted-foreground">
                      {entry.referenceCode ?? "—"}
                    </DataTableTd>
                    <DataTableTd className="text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </DataTableTd>
                    <DataTableTd>
                      {entry.kind === "topup" ? (
                        <TopUpStatusBadge status={entry.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">{entry.status}</span>
                      )}
                    </DataTableTd>
                    <DataTableTd align="right" mono>
                      <span
                        className={
                          entry.status === "PAID" || entry.status === "CREDIT"
                            ? "text-success"
                            : ""
                        }
                      >
                        {entry.status === "CREDIT" || entry.status === "PAID" ? "+" : ""}
                        {formatMoney(entry.netAmount)}
                      </span>
                    </DataTableTd>
                    <DataTableTd align="right">
                      {entry.kind === "topup" && (
                        <Button variant="ghost" size="sm" className="h-8" asChild>
                          <FastLink href={`/billing/topup/${entry.id}`}>{t("common.view")}</FastLink>
                        </Button>
                      )}
                    </DataTableTd>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </div>
      </Panel>

      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" className="h-8" asChild>
              <FastLink
                href={`/billing/transactions?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              >
                {t("common.previous")}
              </FastLink>
            </Button>
          )}
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {t("common.pageOf", { page, total: totalPages })}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" className="h-8" asChild>
              <FastLink
                href={`/billing/transactions?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              >
                {t("common.next")}
              </FastLink>
            </Button>
          )}
        </div>
      )}
    </>
  );
}
