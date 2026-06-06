"use client";

import type { PurchasePeriodStats, PurchaseStatistics } from "@dior/backend";
import { useI18n } from "@/lib/i18n/store";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

type PeriodKey = "last24Hours" | "last7Days" | "last30Days" | "allTime";

type MetricDef = {
  labelKey: string;
  hintKey?: string;
  get: (s: PurchasePeriodStats) => string;
  emphasize?: boolean;
};

const METRICS: MetricDef[] = [
  { labelKey: "controlStatistics.comparison.topUps", hintKey: "controlStatistics.comparison.topUpsPaid", get: (s) => String(s.topUps), emphasize: true },
  { labelKey: "controlStatistics.comparison.grossVolume", get: (s) => formatMoney(s.topUpVolume), emphasize: true },
  { labelKey: "controlStatistics.comparison.netCredited", get: (s) => formatMoney(s.topUpNet) },
  { labelKey: "controlStatistics.comparison.newUsers", get: (s) => String(s.newUsers) },
  { labelKey: "controlStatistics.comparison.newServices", get: (s) => String(s.newServices) },
  { labelKey: "controlStatistics.comparison.invoicesPaid", get: (s) => String(s.invoicesPaid) },
  { labelKey: "controlStatistics.comparison.invoiceVolume", get: (s) => formatMoney(s.invoiceVolume) },
  { labelKey: "controlStatistics.comparison.tickets", hintKey: "controlStatistics.comparison.ticketsOpened", get: (s) => String(s.ticketsOpened) },
];

function cellValue(raw: string) {
  if (raw === "0" || raw === "$0.00") {
    return <span className="text-muted-foreground/60">—</span>;
  }
  return raw;
}

export function StatisticsComparisonTable({ stats }: { stats: PurchaseStatistics }) {
  const { t } = useI18n();

  const periods: { key: PeriodKey; label: string; short: string }[] = [
    { key: "last24Hours", label: t("controlStatistics.comparison.period24h"), short: t("controlStatistics.comparison.period24hShort") },
    { key: "last7Days", label: t("controlStatistics.comparison.period7d"), short: t("controlStatistics.comparison.period7dShort") },
    { key: "last30Days", label: t("controlStatistics.comparison.period30d"), short: t("controlStatistics.comparison.period30dShort") },
    { key: "allTime", label: t("controlStatistics.comparison.periodAll"), short: t("controlStatistics.comparison.periodAllShort") },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground">
              {t("controlStatistics.comparison.metric")}
            </th>
            {periods.map((p) => (
              <th
                key={p.key}
                className="pb-3 px-3 text-right text-xs font-medium text-muted-foreground"
              >
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.short}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {METRICS.map((metric) => (
            <tr key={metric.labelKey} className="group transition-colors hover:bg-muted/20">
              <td className="py-3.5 pr-4">
                <span
                  className={cn(
                    "font-medium",
                    metric.emphasize ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(metric.labelKey)}
                </span>
                {metric.hintKey && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{t(metric.hintKey)}</span>
                )}
              </td>
              {periods.map((p) => (
                <td
                  key={p.key}
                  className={cn(
                    "py-3.5 px-3 text-right tabular-nums",
                    metric.emphasize ? "font-semibold text-foreground" : "text-foreground/90",
                  )}
                >
                  {cellValue(metric.get(stats[p.key]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
