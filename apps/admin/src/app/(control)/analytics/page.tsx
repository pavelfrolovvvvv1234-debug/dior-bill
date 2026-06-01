import { getControlAnalytics } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { KpiCard } from "@/components/control/kpi-card";
import { Panel } from "@/components/control/panel";
import { requireControlSession } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

type AdminAnalytics = {
  users: { total: number; active: number };
  services: { active: number; byType: Array<{ type: string; _count: number }> };
  revenue: { mrr: number; thisMonth: number; lastMonth: number };
  nodeLoad: Array<{ id: string; name: string; loadPercent: number; activeVps: number }>;
  retention: string;
};

export default async function AnalyticsPage() {
  const actor = await requireControlSession();
  const a = (await getControlAnalytics(actor.id)) as AdminAnalytics;

  return (
    <>
      <PageHeader title="Analytics" description="Revenue, retention, and growth" />
      <PageContainer>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="MRR" value={formatMoney(Number(a.revenue.mrr))} />
          <KpiCard label="Revenue this month" value={formatMoney(Number(a.revenue.thisMonth))} />
          <KpiCard label="Active users" value={String(a.users.active)} />
          <KpiCard label="Retention" value={`${a.retention}%`} />
        </div>
        <Panel title="Services by type">
          <ul className="space-y-2 text-sm">
            {a.services.byType.map((row) => (
              <li key={row.type} className="flex justify-between">
                <span>{row.type}</span>
                <span>{row._count}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Node load">
          <ul className="space-y-2 text-sm">
            {a.nodeLoad.map((n) => (
              <li key={n.id} className="flex justify-between">
                <span>{n.name}</span>
                <span>{n.loadPercent.toFixed(1)}% · {n.activeVps} VPS</span>
              </li>
            ))}
          </ul>
        </Panel>
      </PageContainer>
    </>
  );
}
