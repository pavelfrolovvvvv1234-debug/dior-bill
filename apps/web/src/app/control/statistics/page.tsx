import { getPurchaseStatistics } from "@dior/backend";
import { I18nPageHeader } from "@/components/i18n/i18n-page-header";
import { PageContainer } from "@/components/control/page-container";
import { KpiCard } from "@/components/control/kpi-card";
import { Panel } from "@/components/control/panel";
import { StatisticsComparisonTable } from "@/components/control/statistics-comparison-table";
import { StatisticsOpsPanel } from "@/components/control/statistics-ops-panel";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/utils";
import { DollarSign, Server, TrendingUp, Users, Wallet } from "lucide-react";

export default async function StatisticsPage() {
  const actor = await requireControlSession();
  const [stats, t, locale] = await Promise.all([
    getPurchaseStatistics(actor.id),
    getServerT(),
    getServerLocale(),
  ]);
  const updatedDate = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(stats.generatedAt));
  const m30 = stats.last30Days;
  const w7 = stats.last7Days;

  const allTimeItems = [
    { labelKey: "controlStatistics.allTime.totalTopUps", value: String(stats.allTime.topUps), icon: Wallet },
    { labelKey: "controlStatistics.allTime.grossVolume", value: formatMoney(stats.allTime.topUpVolume), icon: DollarSign },
    { labelKey: "controlStatistics.allTime.usersRegistered", value: String(stats.allTime.newUsers), icon: Users },
    { labelKey: "controlStatistics.allTime.servicesCreated", value: String(stats.allTime.newServices), icon: Server },
  ] as const;

  return (
    <>
      <I18nPageHeader
        titleKey="controlStatistics.title"
        descriptionKey="controlStatistics.description"
      />
      <PageContainer className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("controlStatistics.kpi.revenue30")}
            value={formatMoney(m30.topUpVolume)}
            hint={t("controlStatistics.kpi.revenue7Hint", { amount: formatMoney(w7.topUpVolume) })}
            icon={DollarSign}
            href={controlPath("/billing")}
          />
          <KpiCard
            label={t("controlStatistics.kpi.netCredited30")}
            value={formatMoney(m30.topUpNet)}
            hint={t("controlStatistics.kpi.paidTopUpsHint", { count: m30.topUps })}
            icon={TrendingUp}
            href={controlPath("/billing/top-ups")}
          />
          <KpiCard
            label={t("controlStatistics.kpi.newUsers30")}
            value={String(m30.newUsers)}
            hint={t("controlStatistics.kpi.newUsersWeekHint", { count: w7.newUsers })}
            icon={Users}
            href={controlPath("/users")}
          />
          <KpiCard
            label={t("controlStatistics.kpi.newServices30")}
            value={String(m30.newServices)}
            hint={t("controlStatistics.kpi.activeServicesHint", { count: m30.activeServices })}
            icon={Server}
            href={controlPath("/services")}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel
              title={t("controlStatistics.comparison.title")}
              description={t("controlStatistics.comparison.description")}
              noPadding
            >
              <div className="px-5 pb-5 pt-1">
                <StatisticsComparisonTable stats={stats} />
              </div>
            </Panel>
          </div>

          <Panel
            title={t("controlStatistics.attention.title")}
            description={t("controlStatistics.attention.description")}
          >
            <StatisticsOpsPanel stats={m30} />
          </Panel>
        </div>

        <Panel
          title={t("controlStatistics.allTime.title")}
          description={t("controlStatistics.allTime.description")}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {allTimeItems.map((item) => (
              <div key={item.labelKey} className="panel px-4 py-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {t(item.labelKey)}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <p className="text-center text-xs text-muted-foreground">
          {t("controlStatistics.updated", { date: updatedDate })}
        </p>
      </PageContainer>
    </>
  );
}
