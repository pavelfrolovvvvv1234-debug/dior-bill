import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Layers,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { ControlDashboard } from "@dior/backend";
import { BillingStatusBadge } from "@/components/control/billing/status-badge";
import { Badge } from "@/components/ui/badge";
import { controlPath } from "@/lib/control-paths";
import { cn, formatCompact, formatMoney, formatRelative } from "@/lib/utils";

type Props = {
  data: ControlDashboard;
};

function StatCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: "default" | "warning" | "danger";
}) {
  const inner = (
    <div
      className={cn(
        "panel group relative overflow-hidden p-5 transition-all duration-200",
        href && "hover:border-border/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border",
            accent === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
            accent === "danger" && "border-red-500/20 bg-red-500/10 text-red-400",
            (!accent || accent === "default") && "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function FeedPanel({
  title,
  description,
  href,
  linkLabel,
  children,
  empty,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="panel flex flex-col overflow-hidden">
      <div className="panel-header !flex-row !items-start">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
        >
          {linkLabel}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex-1">{empty ? <EmptyFeed label={description} /> : children}</div>
    </section>
  );
}

function EmptyFeed({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/30">
        <AlertCircle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-sm text-muted-foreground">Nothing here yet</p>
      <p className="mt-1 max-w-[220px] text-xs text-muted-foreground/70">{label}</p>
    </div>
  );
}

function FeedRow({
  href,
  primary,
  secondary,
  meta,
  badge,
}: {
  href: string;
  primary: string;
  secondary?: string;
  meta?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-0 hover:bg-muted/20"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{primary}</p>
        {secondary && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta && <span className="text-xs tabular-nums text-muted-foreground">{meta}</span>}
        {badge}
      </div>
    </Link>
  );
}

export function DashboardOverview({ data }: Props) {
  const { kpis } = data;
  const attentionCount = kpis.topUpsAwaiting + kpis.failedTopUps + kpis.openTickets;

  return (
    <div className="space-y-6">
      {attentionCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.5} />
          <p className="text-sm text-amber-100/90">
            <span className="font-medium">{attentionCount} items</span> need your attention
            {kpis.topUpsAwaiting > 0 && ` · ${kpis.topUpsAwaiting} top-ups pending`}
            {kpis.failedTopUps > 0 && ` · ${kpis.failedTopUps} failed payments`}
            {kpis.openTickets > 0 && ` · ${kpis.openTickets} open tickets`}
          </p>
          <Link
            href={controlPath("/billing/top-ups?status=MANUAL_REVIEW")}
            className="ml-auto text-xs font-medium text-amber-300 hover:text-amber-200"
          >
            Review queue →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Top-ups this month"
          value={formatMoney(kpis.topUpsPaidMonthAmount)}
          sub={`${kpis.topUpsPaidMonth} completed`}
          href={controlPath("/billing/top-ups")}
          icon={Wallet}
        />
        <StatCard
          label="Awaiting payment"
          value={String(kpis.topUpsAwaiting)}
          sub={kpis.failedTopUps > 0 ? `${kpis.failedTopUps} failed` : "Pending & review"}
          href={controlPath("/billing/top-ups?status=MANUAL_REVIEW")}
          icon={TrendingUp}
          accent={kpis.topUpsAwaiting > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Users"
          value={formatCompact(kpis.totalUsers)}
          sub={`${formatCompact(kpis.activeUsers30d)} active · 30d`}
          href={controlPath("/users")}
          icon={Users}
        />
        <StatCard
          label="Active services"
          value={String(kpis.activeServices)}
          sub={`${kpis.openTickets} open tickets`}
          href={controlPath("/services")}
          icon={Layers}
        />
      </div>

      <FeedPanel
        title="Recent top-ups"
        description="Latest balance deposits across all providers"
        href={controlPath("/billing/top-ups")}
        linkLabel="All top-ups"
        empty={data.recentTopUps.length === 0}
      >
        {data.recentTopUps.map((t) => (
          <FeedRow
            key={t.id}
            href={controlPath(`/billing/top-ups/${t.id}`)}
            primary={formatMoney(t.amount)}
            secondary={t.user.email ?? t.user.telegramUsername ?? "Unknown customer"}
            meta={formatRelative(t.createdAt)}
            badge={<BillingStatusBadge status={t.status} />}
          />
        ))}
      </FeedPanel>

      <div className="grid gap-6 lg:grid-cols-3">
        <FeedPanel
          title="New users"
          description="Latest account registrations"
          href={controlPath("/users")}
          linkLabel="All users"
          empty={data.recentUsers.length === 0}
        >
          {data.recentUsers.map((u) => (
            <FeedRow
              key={u.id}
              href={controlPath(`/users/${u.id}`)}
              primary={u.email ?? `User ${u.id.slice(0, 8)}`}
              meta={formatRelative(u.createdAt)}
              badge={<Badge variant={u.status === "ACTIVE" ? "success" : "outline"}>{u.status}</Badge>}
            />
          ))}
        </FeedPanel>

        <FeedPanel
          title="Recent services"
          description="Newly provisioned services"
          href={controlPath("/services")}
          linkLabel="All services"
          empty={data.recentServices.length === 0}
        >
          {data.recentServices.map((s) => (
            <FeedRow
              key={s.id}
              href={controlPath(`/services/${s.id}`)}
              primary={s.label}
              secondary={s.user.email ?? "—"}
              meta={formatRelative(s.createdAt)}
              badge={<Badge variant={s.status === "ACTIVE" ? "success" : "outline"}>{s.status}</Badge>}
            />
          ))}
        </FeedPanel>

        <FeedPanel
          title="Support inbox"
          description="Tickets waiting for staff"
          href={controlPath("/support")}
          linkLabel="Open inbox"
          empty={data.recentTickets.length === 0}
        >
          {data.recentTickets.map((t) => (
            <FeedRow
              key={t.id}
              href={controlPath(`/support/${t.id}`)}
              primary={t.subject}
              meta={formatRelative(t.updatedAt)}
              badge={
                <Badge variant={t.priority === "HIGH" || t.priority === "URGENT" ? "destructive" : "warning"}>
                  {t.priority}
                </Badge>
              }
            />
          ))}
        </FeedPanel>
      </div>
    </div>
  );
}
