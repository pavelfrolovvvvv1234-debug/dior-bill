import Link from "next/link";
import { getAdminBillingOverview } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { KpiCard } from "@/components/control/kpi-card";
import { Panel } from "@/components/control/panel";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatMoney } from "@/lib/utils";
import { DollarSign, FileText, ShieldAlert, Wallet } from "lucide-react";

export default async function BillingOverviewPage() {
  const actor = await requireControlSession();
  const data = await getAdminBillingOverview(actor.id);

  return (
    <>
      <PageHeader
        title="Billing command center"
        description="Revenue, top-ups, invoices, ledger, and reconciliation in one place"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenue this month"
          value={formatMoney(data.invoices.revenueThisMonth)}
          icon={DollarSign}
          href={controlPath("/billing/invoices")}
        />
        <KpiCard
          label="Pending invoices"
          value={String(data.invoices.pending)}
          hint={`${data.invoices.overdue} overdue`}
          icon={FileText}
          href={controlPath("/billing/invoices?status=PENDING")}
        />
        <KpiCard
          label="Manual review"
          value={String(data.topUps.manualReview)}
          hint={`${data.topUps.failed} failed`}
          icon={ShieldAlert}
          href={controlPath("/billing/top-ups?status=MANUAL_REVIEW")}
        />
        <KpiCard
          label="Wallet liability"
          value={formatMoney(data.wallet.totalBalance)}
          hint={`${formatMoney(data.wallet.totalLocked)} locked`}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top-up pipeline">
          <ul className="space-y-2 text-sm">
            {data.topUps.byStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between gap-3">
                <BillingStatusBadge status={s.status} />
                <span className="font-mono tabular-nums">{s.count} · {formatMoney(s.volume)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Providers (month)">
          <ul className="space-y-2 text-sm">
            {data.providers.map((p) => (
              <li key={p.provider} className="flex items-center justify-between gap-3">
                <span>{p.provider}</span>
                <span className="font-mono tabular-nums">{p.count} · {formatMoney(p.netAmount)}</span>
              </li>
            ))}
            {data.providers.length === 0 && (
              <p className="text-[var(--muted-foreground)]">No paid top-ups this month</p>
            )}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Recent reconciliation"
        action={
          <Link href={controlPath("/billing/reconciliation")} className="text-xs text-primary">
            Open reconcile
          </Link>
        }
      >
        <ul className="space-y-2 text-sm">
          {data.recentReconciliation.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs">{r.domain}</span>
              <BillingStatusBadge status={r.status.toUpperCase()} />
              <span className="text-xs text-[var(--muted-foreground)]">
                {r.fixesApplied} fixes
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
