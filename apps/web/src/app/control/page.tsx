import Link from "next/link";
import {
  Activity,
  DollarSign,
  Layers,
  Server,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { getControlDashboard } from "@dior/backend";
import { PageHeader } from "@/components/control/page-header";
import { PageContainer } from "@/components/control/page-container";
import { KpiCard } from "@/components/control/kpi-card";
import { Panel } from "@/components/control/panel";
import { Badge } from "@/components/ui/badge";
import { requireControlSession } from "@/lib/auth";
import { controlPath } from "@/lib/control-paths";
import { formatCompact, formatMoney, formatDate } from "@/lib/utils";

export default async function ControlDashboardPage() {
  const actor = await requireControlSession();
  const data = await getControlDashboard(actor.id);
  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Executive dashboard"
        description="Real-time control plane — revenue, infrastructure, and operations"
        actions={
          <Badge variant={data.health.status === "healthy" ? "success" : "warning"}>
            System {data.health.status}
          </Badge>
        }
      />
      <PageContainer>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="MRR" value={formatMoney(kpis.mrr)} icon={DollarSign} href={controlPath("/analytics")} />
          <KpiCard
            label="Revenue (month)"
            value={formatMoney(kpis.revenueMonth)}
            icon={DollarSign}
          />
          <KpiCard
            label="Active users (30d)"
            value={formatCompact(kpis.activeUsers30d)}
            hint={`${kpis.totalUsers} total`}
            icon={Users}
            href={controlPath("/users")}
          />
          <KpiCard
            label="Active services"
            value={String(kpis.activeServices)}
            icon={Layers}
            href={controlPath("/services")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="VPS deployed" value={String(kpis.vpsDeployed)} icon={Server} />
          <KpiCard label="Dedicated active" value={String(kpis.dedicatedActive)} />
          <KpiCard label="Domains" value={String(kpis.domainsActive)} />
          <KpiCard label="CDN zones" value={String(kpis.cdnZones)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Pending invoices"
            value={String(kpis.pendingInvoices)}
            href={controlPath("/billing")}
          />
          <KpiCard
            label="Failed payments"
            value={String(kpis.failedPayments)}
            href={controlPath("/billing/top-ups?status=FAILED")}
          />
          <KpiCard
            label="Referral payouts"
            value={String(kpis.referralPayoutsPending)}
            href={controlPath("/referrals")}
          />
          <KpiCard label="Open tickets" value={String(kpis.openTickets)} icon={Ticket} href={controlPath("/support")} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Recent users" description="Latest registrations" action={<Link href={controlPath("/users")} className="text-xs text-primary">View all</Link>}>
            <ul className="space-y-3 text-sm">
              {data.recentUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2">
                  <Link href={controlPath(`/users/${u.id}`)} className="truncate hover:text-primary">
                    {u.email ?? u.id.slice(0, 8)}
                  </Link>
                  <Badge>{u.status}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Open tickets" description="Needs staff attention" action={<Link href={controlPath("/support")} className="text-xs text-primary">Inbox</Link>}>
            <ul className="space-y-3 text-sm">
              {data.recentTickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <Link href={controlPath(`/support/${t.id}`)} className="truncate hover:text-primary">
                    {t.subject}
                  </Link>
                  <span className="text-xs text-[var(--muted-foreground)]">{t.priority}</span>
                </li>
              ))}
              {data.recentTickets.length === 0 && (
                <p className="text-[var(--muted-foreground)]">No open tickets</p>
              )}
            </ul>
          </Panel>
        </div>

        <Panel title="Node load" description={`Avg ${data.health.avgLoad.toFixed(1)}% · Queue ${kpis.provisioningQueue}`} noPadding>
          <div className="divide-y divide-white/6">
            {data.nodes.map((n) => (
              <div key={n.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{n.name}</span>
                <span className="text-[var(--muted-foreground)]">
                  {n.activeVps} VPS · {n.loadPercent.toFixed(0)}% load
                </span>
                <Badge variant={n.status === "online" ? "success" : "warning"}>{n.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </PageContainer>
    </>
  );
}
