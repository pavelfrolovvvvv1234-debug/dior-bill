import { getPurchaseStatistics } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { KpiCard } from "@/components/control/kpi-card";
import { StatisticsPeriodCard } from "@/components/control/statistics-period-card";
import { requireControlSession } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { DollarSign, Users, Wallet, Server, Ticket, TrendingUp } from "lucide-react";

export default async function StatisticsPage() {
  const actor = await requireControlSession();
  const stats = await getPurchaseStatistics(actor.id);
  const m30 = stats.last30Days;

  return (
    <>
      <PageHeader
        title="Statistics"
        description="Revenue, growth, services, and operations — live from billing data"
      />
      <PageContainer className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="30d gross"
            value={formatMoney(m30.topUpVolume)}
            hint="Paid top-ups"
            icon={DollarSign}
          />
          <KpiCard
            label="30d net"
            value={formatMoney(m30.topUpNet)}
            hint="After fees"
            icon={TrendingUp}
          />
          <KpiCard label="30d top-ups" value={String(m30.topUps)} icon={Wallet} />
          <KpiCard label="30d new users" value={String(m30.newUsers)} icon={Users} />
          <KpiCard label="30d new services" value={String(m30.newServices)} icon={Server} />
          <KpiCard
            label="Open tickets"
            value={String(m30.ticketsOpened)}
            hint="Created in 30d"
            icon={Ticket}
          />
        </div>

        <div>
          <h2 className="mb-1 text-base font-semibold">Purchase statistics</h2>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            Compare periods side by side. Updated {new Date(stats.generatedAt).toLocaleString()}.
          </p>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <StatisticsPeriodCard title="Last 24 hours" stats={stats.last24Hours} />
            <StatisticsPeriodCard title="Last 7 days" stats={stats.last7Days} />
            <StatisticsPeriodCard title="Last 30 days" stats={stats.last30Days} />
            <StatisticsPeriodCard title="All time" stats={stats.allTime} />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
