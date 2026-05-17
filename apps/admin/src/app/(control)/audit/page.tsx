import { listAdminAuditLogs } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { requireControlSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function AuditPage() {
  const actor = await requireControlSession();
  const data = await listAdminAuditLogs(actor.id, { page: 1, pageSize: 50 });

  return (
    <>
      <PageHeader title="Audit log" description="Immutable trail of all control-plane actions" />
      <PageContainer>
        <Panel title="Recent events">
          <ul className="space-y-2 font-mono text-xs">
            {data.items.map((a) => (
              <li key={a.id} className="border-b border-white/6 py-2">
                <span className="text-[var(--muted-foreground)]">{formatDate(a.createdAt)}</span>
                {" · "}
                <span className="text-primary">{a.action}</span>
                {" · "}
                {a.entityType}/{a.entityId}
                {a.actor?.email && ` · by ${a.actor.email}`}
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
