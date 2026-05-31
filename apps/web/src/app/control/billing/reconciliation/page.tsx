import { listReconciliationRuns } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { Panel } from "@/components/control/panel";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/control/data-table";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { ReconciliationActions } from "@/components/control/billing/reconciliation-actions";
import { requireControlSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function ReconciliationPage() {
  const actor = await requireControlSession();
  const data = await listReconciliationRuns(actor.id);

  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Detect and fix billing, inventory, and provisioning drift"
      />
      <Panel title="Run reconciliation">
        <ReconciliationActions />
      </Panel>
      <Panel title="Run history" noPadding>
        <DataTable>
          <DataTableHead>
            <DataTableTh>Domain</DataTableTh>
            <DataTableTh>Status</DataTableTh>
            <DataTableTh>Fixes</DataTableTh>
            <DataTableTh>Started</DataTableTh>
            <DataTableTh>Completed</DataTableTh>
          </DataTableHead>
          <DataTableBody>
            {data.items.map((run) => (
              <DataTableRow key={run.id}>
                <DataTableTd mono className="text-xs">{run.domain}</DataTableTd>
                <DataTableTd><BillingStatusBadge status={run.status.toUpperCase()} /></DataTableTd>
                <DataTableTd>{run.fixesApplied}</DataTableTd>
                <DataTableTd className="text-[var(--muted-foreground)]">{formatDate(run.startedAt)}</DataTableTd>
                <DataTableTd className="text-[var(--muted-foreground)]">
                  {run.completedAt ? formatDate(run.completedAt) : "—"}
                </DataTableTd>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Panel>
    </>
  );
}
