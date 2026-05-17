import type { PurchasePeriodStats } from "@dior/backend";
import { formatMoney } from "@/lib/utils";

type StatRow = { label: string; value: string; highlight?: boolean };

function rowsForPeriod(s: PurchasePeriodStats): { title: string; rows: StatRow[] }[] {
  return [
    {
      title: "Revenue & top-ups",
      rows: [
        { label: "Top-ups (paid)", value: String(s.topUps), highlight: true },
        { label: "Gross volume", value: formatMoney(s.topUpVolume) },
        { label: "Net credited", value: formatMoney(s.topUpNet) },
        { label: "Fees", value: formatMoney(s.topUpFees) },
        { label: "Avg. top-up", value: formatMoney(s.avgTopUp) },
        { label: "Failed", value: String(s.failedTopUps) },
        { label: "Pending", value: String(s.pendingTopUps) },
        { label: "Manual review", value: String(s.manualReviewTopUps) },
      ],
    },
    {
      title: "Users",
      rows: [
        { label: "New registrations", value: String(s.newUsers), highlight: true },
        { label: "Email verified", value: String(s.emailVerifiedUsers) },
        { label: "Logged in", value: String(s.usersWithLogin) },
      ],
    },
    {
      title: "Services & billing",
      rows: [
        { label: "New services", value: String(s.newServices) },
        { label: "Activated (new)", value: String(s.activeServices) },
        { label: "Service spend", value: formatMoney(s.serviceSpend) },
        { label: "Invoices paid", value: String(s.invoicesPaid) },
        { label: "Invoice volume", value: formatMoney(s.invoiceVolume) },
      ],
    },
    {
      title: "Support & partners",
      rows: [
        { label: "Tickets opened", value: String(s.ticketsOpened) },
        { label: "Tickets resolved", value: String(s.ticketsResolved) },
        { label: "Referral earnings", value: formatMoney(s.referralEarnings) },
        { label: "Payouts pending", value: String(s.payoutRequests) },
      ],
    },
  ];
}

export function StatisticsPeriodCard({
  title,
  stats,
}: {
  title: string;
  stats: PurchasePeriodStats;
}) {
  const sections = rowsForPeriod(stats);

  return (
    <article className="flex flex-col rounded-lg border border-white/6 bg-white/[0.02]">
      <header className="border-b border-white/6 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          Profit {formatMoney(stats.profit)} · {stats.newUsers} new users
        </p>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-primary/80">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.rows.map((row, i) => {
                const isLast = i === section.rows.length - 1;
                const prefix = isLast ? "└" : "├";
                return (
                  <li
                    key={row.label}
                    className="flex gap-2 font-mono text-xs sm:text-sm text-[var(--muted-foreground)]"
                  >
                    <span className="w-3 shrink-0 text-white/25">{prefix}</span>
                    <span className="min-w-0 flex-1">
                      {row.label}:{" "}
                      <span
                        className={
                          row.highlight ? "font-medium text-primary" : "text-foreground"
                        }
                      >
                        {row.value}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}
