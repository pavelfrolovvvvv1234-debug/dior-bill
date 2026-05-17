"use client";

import { FastLink } from "@/components/ui/fast-link";
import {
  Server,
  CreditCard,
  Wallet,
  Users,
  ArrowUpRight,
  LifeBuoy,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/enterprise/kpi-card";
import { Panel } from "@/components/ui/enterprise/panel";
import { StatusIndicator, mapServiceStatus } from "@/components/ui/enterprise/status-indicator";
import { MetricChart } from "@/components/ui/enterprise/metric-chart";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from "@/components/ui/enterprise/data-table";
import { formatMoney, formatRelative } from "@/lib/utils";
import type { DashboardStats } from "@dior/shared";
import { ActivityCenter, type ActivityItem } from "@/components/activity-center";
import type { InfraStatusPage } from "@dior/backend";
import { Badge } from "@/components/ui/badge";

interface ServiceItem {
  id: string;
  type: string;
  status: string;
  label: string;
  renewsAt: Date | null;
  vpsInstance?: {
    id: string;
    primaryIp: string | null;
    cpuUsage: number;
    ramUsage: number;
  } | null;
}

interface FeedItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  createdAt: Date;
}

interface Props {
  stats: DashboardStats;
  services: ServiceItem[];
  feed: FeedItem[];
  notifications: { id: string; title: string; body: string; read: boolean; createdAt: Date }[];
  referralEarnings: number;
  activity: ActivityItem[];
  infraStatus: InfraStatusPage;
}

const severityVariant: Record<string, "default" | "success" | "warning" | "muted"> = {
  info: "default",
  success: "success",
  warning: "warning",
};

export function DashboardContent({
  stats,
  services,
  feed,
  referralEarnings,
  activity,
  infraStatus,
}: Props) {
  const trafficData = [
    { label: "Mon", value: 42 },
    { label: "Tue", value: 58 },
    { label: "Wed", value: 51 },
    { label: "Thu", value: 67 },
    { label: "Fri", value: 63 },
    { label: "Sat", value: 48 },
    { label: "Sun", value: 55 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Balance" value={formatMoney(stats.balance)} icon={Wallet} href="/billing" />
        <KpiCard
          label="Active services"
          value={String(stats.activeServices)}
          icon={Server}
          href="/services"
        />
        <KpiCard
          label="Pending invoices"
          value={String(stats.pendingInvoices)}
          icon={CreditCard}
          href="/billing"
        />
        <KpiCard
          label="Referral earnings"
          value={formatMoney(referralEarnings)}
          icon={Users}
          href="/referrals"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel
          title="System health"
          description="Platform-wide status"
          className="lg:col-span-4"
        >
          <div className="space-y-4">
            <StatusIndicator
              status={infraStatus.overall === "operational" ? "operational" : "degraded"}
              label={
                infraStatus.overall === "operational"
                  ? "All systems operational"
                  : `Status: ${infraStatus.overall}`
              }
            />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Live deployments</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{infraStatus.activeDeployments}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Nodes online</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {infraStatus.nodes.filter((n) => n.status === "online").length}/
                  {infraStatus.nodes.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Uptime SLA</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">99.98%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Abuse queue</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">0 open</dd>
              </div>
            </dl>
            <Button variant="outline" size="sm" className="h-8 w-full" asChild>
              <FastLink href="/status">Public status page</FastLink>
            </Button>
          </div>
        </Panel>

        <Panel
          title="Traffic overview"
          description="Egress (7d) — aggregate"
          className="lg:col-span-8"
          action={
            <Button variant="ghost" size="sm" className="h-8" asChild>
              <FastLink href="/plans?tab=cdn">CDN</FastLink>
            </Button>
          }
        >
          <MetricChart data={trafficData} height={140} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel
          title="Active services"
          description="Your running infrastructure"
          className="lg:col-span-8"
          action={
            <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
              <FastLink href="/services">
                View all
                <ArrowUpRight className="h-3.5 w-3.5" />
              </FastLink>
            </Button>
          }
          noPadding
        >
          <DataTable>
            <DataTableHead>
              <DataTableTh>Service</DataTableTh>
              <DataTableTh>Endpoint</DataTableTh>
              <DataTableTh>Status</DataTableTh>
              <DataTableTh align="right">CPU</DataTableTh>
            </DataTableHead>
            <DataTableBody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No active services.{" "}
                    <FastLink href="/plans?tab=bulletproof-vps" className="text-primary hover:underline">
                      Select plan
                    </FastLink>
                  </td>
                </tr>
              ) : (
                services.slice(0, 6).map((s) => (
                  <DataTableRow key={s.id}>
                    <DataTableTd>
                      <FastLink
                        href={s.vpsInstance ? `/vps/${s.vpsInstance.id}` : "/services"}
                        className="font-medium hover:text-primary"
                      >
                        {s.label}
                      </FastLink>
                      <p className="text-xs text-muted-foreground">{s.type}</p>
                    </DataTableTd>
                    <DataTableTd mono className="text-muted-foreground">
                      {s.vpsInstance?.primaryIp ?? "—"}
                    </DataTableTd>
                    <DataTableTd>
                      <StatusIndicator status={mapServiceStatus(s.status)} label={s.status} />
                    </DataTableTd>
                    <DataTableTd align="right" mono>
                      {s.vpsInstance ? `${s.vpsInstance.cpuUsage}%` : "—"}
                    </DataTableTd>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </Panel>

        <Panel title="Infrastructure feed" className="lg:col-span-4">
          <div className="space-y-4">
            {feed.slice(0, 5).map((item) => (
              <article key={item.id} className="border-l-2 border-primary/40 pl-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <Badge variant={severityVariant[item.severity] ?? "muted"} className="shrink-0 text-[10px]">
                    {item.type}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{formatRelative(item.createdAt)}</p>
              </article>
            ))}
            <Button variant="ghost" size="sm" className="h-8 w-full" asChild>
              <FastLink href="/infrastructure">View feed</FastLink>
            </Button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityCenter items={activity} />

        <Panel title="Quick actions" description="Common operations">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Select plan", href: "/plans", icon: Server },
              { label: "Top up balance", href: "/billing/topup", icon: Wallet },
              { label: "Support", href: "/support", icon: LifeBuoy },
              { label: "Affiliate", href: "/referrals", icon: Users },
              { label: "Activity log", href: "/infrastructure", icon: Activity },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Button key={a.href} variant="outline" className="h-auto justify-start gap-2 py-3" asChild>
                  <FastLink href={a.href}>
                    <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                    {a.label}
                  </FastLink>
                </Button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
