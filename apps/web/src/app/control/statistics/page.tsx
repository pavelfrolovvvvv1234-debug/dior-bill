import { getPurchaseStatistics } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { KpiCard } from "@/components/control/kpi-card";
import { Panel } from "@/components/control/panel";
import { StatisticsComparisonTable } from "@/components/control/statistics-comparison-table";
import { StatisticsOpsPanel } from "@/components/control/statistics-ops-panel";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney, formatDate } from "@/lib/utils";
import { DollarSign, Server, TrendingUp, Users, Wallet } from "lucide-react";

export default async function StatisticsPage() {
  const actor = await requireControlSession();
  const stats = await getPurchaseStatistics(actor.id);
  const m30 = stats.last30Days;
  const w7 = stats.last7Days;

  return (
    <>
      <PageHeader
        title="Statistics"
        description="Key business metrics from billing, growth, and support"
      />
      <PageContainer className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Revenue · 30 days"
            value={formatMoney(m30.topUpVolume)}
            hint={`${formatMoney(w7.topUpVolume)} in the last 7 days`}
            icon={DollarSign}
            href={controlPath("/billing")}
          />
          <KpiCard
            label="Net credited · 30 days"
            value={formatMoney(m30.topUpNet)}
            hint={`${m30.topUps} paid top-ups`}
            icon={TrendingUp}
            href={controlPath("/billing/top-ups")}
          />
          <KpiCard
            label="New users · 30 days"
            value={String(m30.newUsers)}
            hint={`${w7.newUsers} this week`}
            icon={Users}
            href={controlPath("/users")}
          />
          <KpiCard
            label="New services · 30 days"
            value={String(m30.newServices)}
            hint={`${m30.activeServices} activated`}
            icon={Server}
            href={controlPath("/services")}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel
              title="Period comparison"
              description="Core metrics across time ranges"
              noPadding
            >
              <div className="px-5 pb-5 pt-1">
                <StatisticsComparisonTable stats={stats} />
              </div>
            </Panel>
          </div>

          <Panel
            title="Needs attention"
            description="Last 30 days — click to open"
          >
            <StatisticsOpsPanel stats={m30} />
          </Panel>
        </div>

        <Panel
          title="All-time snapshot"
          description={`Wallet inflow and platform scale since launch`}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total top-ups", value: String(stats.allTime.topUps), icon: Wallet },
              { label: "Gross volume", value: formatMoney(stats.allTime.topUpVolume), icon: DollarSign },
              { label: "Users registered", value: String(stats.allTime.newUsers), icon: Users },
              { label: "Services created", value: String(stats.allTime.newServices), icon: Server },
            ].map((item) => (
              <div
                key={item.label}
                className="panel px-4 py-4"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {item.label}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <p className="text-center text-xs text-muted-foreground">
          Updated {formatDate(new Date(stats.generatedAt))}
        </p>
      </PageContainer>
    </>
  );
}
