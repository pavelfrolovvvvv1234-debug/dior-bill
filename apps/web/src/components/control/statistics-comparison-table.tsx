import type { PurchasePeriodStats, PurchaseStatistics } from "@dior/backend";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

type PeriodKey = "last24Hours" | "last7Days" | "last30Days" | "allTime";

const PERIODS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "last24Hours", label: "Last 24 hours", short: "24h" },
  { key: "last7Days", label: "Last 7 days", short: "7d" },
  { key: "last30Days", label: "Last 30 days", short: "30d" },
  { key: "allTime", label: "All time", short: "All" },
];

type MetricDef = {
  label: string;
  hint?: string;
  get: (s: PurchasePeriodStats) => string;
  emphasize?: boolean;
};

const METRICS: MetricDef[] = [
  {
    label: "Top-ups",
    hint: "Paid",
    get: (s) => String(s.topUps),
    emphasize: true,
  },
  {
    label: "Gross volume",
    get: (s) => formatMoney(s.topUpVolume),
    emphasize: true,
  },
  {
    label: "Net credited",
    get: (s) => formatMoney(s.topUpNet),
  },
  {
    label: "New users",
    get: (s) => String(s.newUsers),
  },
  {
    label: "New services",
    get: (s) => String(s.newServices),
  },
  {
    label: "Invoices paid",
    get: (s) => String(s.invoicesPaid),
  },
  {
    label: "Invoice volume",
    get: (s) => formatMoney(s.invoiceVolume),
  },
  {
    label: "Tickets",
    hint: "Opened",
    get: (s) => String(s.ticketsOpened),
  },
];

function cellValue(raw: string) {
  if (raw === "0" || raw === "$0.00") {
    return <span className="text-[var(--muted-foreground)]/60">—</span>;
  }
  return raw;
}

export function StatisticsComparisonTable({ stats }: { stats: PurchaseStatistics }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/6 text-left">
            <th className="pb-3 pr-4 text-xs font-medium text-[var(--muted-foreground)]">Metric</th>
            {PERIODS.map((p) => (
              <th
                key={p.key}
                className="pb-3 px-3 text-right text-xs font-medium text-[var(--muted-foreground)]"
              >
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.short}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {METRICS.map((metric) => (
            <tr key={metric.label} className="group transition-colors hover:bg-white/[0.02]">
              <td className="py-3.5 pr-4">
                <span
                  className={cn(
                    "font-medium",
                    metric.emphasize ? "text-foreground" : "text-[var(--muted-foreground)]",
                  )}
                >
                  {metric.label}
                </span>
                {metric.hint && (
                  <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">{metric.hint}</span>
                )}
              </td>
              {PERIODS.map((p) => (
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
