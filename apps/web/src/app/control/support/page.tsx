import Link from "next/link";
import { listAdminTickets } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import {
  DataTable,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { DataTableClickableRow } from "@/components/control/data-table-clickable-row";
import { TicketPriorityBadge } from "@/components/support/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { TicketRowDelete } from "@/components/control/ticket-row-delete";

export default async function SupportPage() {
  const actor = await requireControlSession();
  const data = await listAdminTickets(actor.id, { page: 1, pageSize: 30 });

  return (
    <>
      <PageHeader title="Tickets" description="Ticket desk — assign, escalate, resolve" />
      <PageContainer>
        <Panel title="Tickets" description="Click a row to open and reply" noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>Subject</DataTableTh>
              <DataTableTh>Customer</DataTableTh>
              <DataTableTh>Priority</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh>Updated</DataTableTh>
              <DataTableTh align="right"> </DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No tickets" colSpan={6} />
              ) : (
                data.items.map((t) => (
                  <DataTableClickableRow key={t.id} href={controlPath(`/support/${t.id}`)}>
                    <DataTableTd>
                      <p className="font-medium">{t.subject}</p>
                    </DataTableTd>
                    <DataTableTd>{t.user.email}</DataTableTd>
                    <DataTableTd>
                      <TicketPriorityBadge priority={t.priority} />
                    </DataTableTd>
                    <DataTableTd>
                      <TicketStatusBadge status={t.status} />
                    </DataTableTd>
                    <DataTableTd className="text-[var(--muted-foreground)]">
                      <LocalDateTime value={t.updatedAt} />
                    </DataTableTd>
                    <DataTableTd align="right">
                      <div className="flex items-center justify-end gap-1">
                        <TicketRowDelete ticketId={t.id} subject={t.subject} />
                        <Link
                          href={controlPath(`/support/${t.id}`)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </DataTableTd>
                  </DataTableClickableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </Panel>
      </PageContainer>
    </>
  );
}
