import { listAdminAuditLogs } from "@dior/backend";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { requireControlSession } from "@/lib/auth";
import { getServerT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

export default async function AuditPage() {
  const actor = await requireControlSession();
  const [data, t] = await Promise.all([
    listAdminAuditLogs(actor.id, { page: 1, pageSize: 50 }),
    getServerT(),
  ]);

  return (
    <>
      <I18nPageHeader
        titleKey="controlLogs.title"
        descriptionKey="controlLogs.description"
      />
      <PageContainer>
        <Panel title={t("controlLogs.recentEvents")}>
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
