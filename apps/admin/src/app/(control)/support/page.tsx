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
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function SupportPage() {
  const actor = await requireControlSession();
  const data = await listAdminTickets(actor.id, { page: 1, pageSize: 30 });

  return (
    <>
      <PageHeader title="Support" description="Ticket desk — assign, escalate, resolve" />
      <PageContainer>
        <Panel title="Tickets" noPadding>
          <DataTable>
            <DataTableHead>
              <DataTableTh>Subject</DataTableTh>
              <DataTableTh>Customer</DataTableTh>
              <DataTableTh>Priority</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh>Updated</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {data.items.length === 0 ? (
                <DataTableEmpty message="No tickets" colSpan={5} />
              ) : (
                data.items.map((t) => (
                  <DataTableRow key={t.id}>
                    <DataTableTd>
                      <Link href={`/support/${t.id}`} className="font-medium hover:text-primary">
                        {t.subject}
                      </Link>
                    </DataTableTd>
                    <DataTableTd>{t.user.email}</DataTableTd>
                    <DataTableTd>{t.priority}</DataTableTd>
                    <DataTableTd><Badge>{t.status}</Badge></DataTableTd>
                    <DataTableTd className="text-[var(--muted-foreground)]">{formatDate(t.updatedAt)}</DataTableTd>
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
