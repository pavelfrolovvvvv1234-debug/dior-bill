import { getPurchaseStatistics } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { Panel } from "@/components/control/panel";
import { requireControlSession } from "@/lib/auth";

type PeriodBlockProps = {
  title: string;
  topUps: number;
  newUsers: number;
  profit: number;
};

function PeriodBlock({ title, topUps, newUsers, profit }: PeriodBlockProps) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.02] p-4">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <ul className="mt-3 space-y-1.5 font-mono text-sm text-[var(--muted-foreground)]">
        <li className="flex gap-2">
          <span className="text-white/30">├</span>
          <span>
            Top-ups: <span className="text-foreground">{topUps}</span>
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-white/30">├</span>
          <span>
            New users: <span className="text-foreground">{newUsers}</span>
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-white/30">└</span>
          <span>
            Profit: <span className="text-foreground">{profit} $</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

export default async function StatisticsPage() {
  const actor = await requireControlSession();
  const stats = await getPurchaseStatistics(actor.id);

  return (
    <>
      <PageHeader
        title="Statistics"
        description="Purchase and registration metrics by period"
      />
      <PageContainer>
        <Panel title="📊 Purchase statistics" noPadding>
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <PeriodBlock title="Last 24 hours" {...stats.last24Hours} />
            <PeriodBlock title="Last 7 days" {...stats.last7Days} />
            <PeriodBlock title="Last 30 days" {...stats.last30Days} />
            <PeriodBlock title="All time" {...stats.allTime} />
          </div>
        </Panel>
      </PageContainer>
    </>
  );
}
