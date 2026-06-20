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
import { Badge } from "@/components/ui/badge";
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
        "group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-5 transition-all duration-200",
        href && "hover:border-white/10 hover:from-white/[0.06]",
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
          <ArrowUpRight className="h-4 w-4 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

const FEED_PANEL_FIXED_HEIGHT = "h-[420px]";

function FeedPanel({
  title,
  description,
  href,
  linkLabel,
  children,
  empty,
  fixedHeight,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
  empty?: boolean;
  fixedHeight?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0f18]/60",
        fixedHeight && FEED_PANEL_FIXED_HEIGHT,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
        </div>
        <Link href={href} className="flex shrink-0 items-center gap-1 text-xs text-primary">
          {linkLabel}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {empty ? (
          <p className="flex flex-1 items-center justify-center px-5 py-12 text-center text-sm text-[var(--muted-foreground)]">
            Nothing here yet
          </p>
        ) : (
          children
        )}
      </div>
    </section>
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
      className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3.5 text-sm transition-colors last:border-0 hover:bg-white/[0.02]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{primary}</p>
        {secondary && <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{secondary}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta && <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{meta}</span>}
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
          </p>
          <Link href="/payments" className="ml-auto text-xs font-medium text-amber-300">
            Review payments →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Top-ups this month" value={formatMoney(kpis.topUpsPaidMonthAmount)} sub={`${kpis.topUpsPaidMonth} completed`} href="/payments" icon={Wallet} />
        <StatCard label="Awaiting payment" value={String(kpis.topUpsAwaiting)} sub="Pending & review" href="/payments" icon={TrendingUp} accent={kpis.topUpsAwaiting > 0 ? "warning" : "default"} />
        <StatCard label="Users" value={formatCompact(kpis.totalUsers)} sub={`${formatCompact(kpis.activeUsers30d)} active · 30d`} href="/users" icon={Users} />
        <StatCard label="Active services" value={String(kpis.activeServices)} sub={`${kpis.openTickets} open tickets`} href="/services" icon={Layers} />
      </div>

      <FeedPanel title="Recent top-ups" description="Latest balance deposits" href="/payments" linkLabel="All payments" empty={data.recentTopUps.length === 0}>
        {data.recentTopUps.map((t) => (
          <FeedRow key={t.id} href="/payments" primary={formatMoney(t.amount)} secondary={t.user.email ?? "—"} meta={formatRelative(t.createdAt)} badge={<Badge>{t.status}</Badge>} />
        ))}
      </FeedPanel>

      <div className="grid gap-6 lg:grid-cols-3">
        <FeedPanel title="New users" description="Latest registrations" href="/users" linkLabel="All users" empty={data.recentUsers.length === 0} fixedHeight>
          {data.recentUsers.map((u) => (
            <FeedRow key={u.id} href={`/users/${u.id}`} primary={u.email ?? u.id.slice(0, 8)} meta={formatRelative(u.createdAt)} badge={<Badge>{u.status}</Badge>} />
          ))}
        </FeedPanel>
        <FeedPanel title="Recent services" description="Newly provisioned" href="/services" linkLabel="All services" empty={data.recentServices.length === 0} fixedHeight>
          {data.recentServices.map((s) => (
            <FeedRow key={s.id} href={`/services/${s.id}`} primary={s.label} secondary={s.user.email ?? "—"} meta={formatRelative(s.createdAt)} badge={<Badge>{s.status}</Badge>} />
          ))}
        </FeedPanel>
        <FeedPanel title="Support inbox" description="Open tickets" href="/support" linkLabel="Inbox" empty={data.recentTickets.length === 0} fixedHeight>
          {data.recentTickets.map((t) => (
            <FeedRow key={t.id} href={`/support/${t.id}`} primary={t.subject} meta={formatRelative(t.updatedAt)} badge={<Badge>{t.priority}</Badge>} />
          ))}
        </FeedPanel>
      </div>
    </div>
  );
}
