import { FastLink } from "@/components/ui/fast-link";
import { requireSession } from "@/lib/auth";
import { getUserLedgerCached } from "@/lib/billing-data";
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
import { TopUpStatusBadge } from "@/components/billing/topup-status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/utils";

export async function TransactionsSection({
  page,
  search,
}: {
  page: number;
  search?: string;
}) {
  const session = await requireSession();
  const ledger = await getUserLedgerCached(session.user.id, page, search);

  return (
    <>
      <Panel title="All activity" description={`Page ${page} of ${ledger.totalPages || 1}`} noPadding>
        <DataTable>
          <DataTableHead>
            <DataTableTh>Description</DataTableTh>
            <DataTableTh>Reference</DataTableTh>
            <DataTableTh>Date</DataTableTh>
            <DataTableTh>Status</DataTableTh>
            <DataTableTh align="right">Amount</DataTableTh>
            <DataTableTh align="right" />
          </DataTableHead>
          <DataTableBody>
            {ledger.items.length === 0 ? (
              <DataTableEmpty message="No transactions yet" colSpan={6} />
            ) : (
              ledger.items.map((entry) => (
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
                        <FastLink href={`/billing/topup/${entry.id}`}>View</FastLink>
                      </Button>
                    )}
                  </DataTableTd>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </Panel>

      {ledger.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" className="h-8" asChild>
              <FastLink href={`/billing/transactions?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}>
                Previous
              </FastLink>
            </Button>
          )}
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {ledger.totalPages}
          </span>
          {page < ledger.totalPages && (
            <Button variant="outline" size="sm" className="h-8" asChild>
              <FastLink href={`/billing/transactions?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}>
                Next
              </FastLink>
            </Button>
          )}
        </div>
      )}
    </>
  );
}
