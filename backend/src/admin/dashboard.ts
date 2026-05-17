import { prisma } from "@dior/database";
import { cacheGet, cacheSet } from "../lib/redis";
import { requirePermission } from "./rbac";

export type ControlDashboard = {
  kpis: {
    mrr: number;
    revenueMonth: number;
    totalUsers: number;
    activeUsers30d: number;
    activeServices: number;
    vpsDeployed: number;
    dedicatedActive: number;
    domainsActive: number;
    cdnZones: number;
    pendingInvoices: number;
    failedPayments: number;
    referralPayoutsPending: number;
    referralEarningsMonth: number;
    openTickets: number;
    provisioningQueue: number;
    avgNodeLoad: number;
  };
  nodes: Array<{
    id: string;
    name: string;
    status: string;
    loadPercent: number;
    activeVps: number;
    capacityPercent: number;
  }>;
  recentUsers: Array<{
    id: string;
    email: string | null;
    status: string;
    role: string;
    createdAt: Date;
  }>;
  recentTickets: Array<{
    id: string;
    subject: string;
    priority: string;
    status: string;
    updatedAt: Date;
  }>;
  health: { status: "healthy" | "degraded"; avgLoad: number };
};

export async function getControlDashboard(actorId: string): Promise<ControlDashboard> {
  await requirePermission(actorId, "analytics.read");

  const cacheKey = "control:dashboard:v1";
  const cached = await cacheGet<ControlDashboard>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    activeUsers30d,
    activeServices,
    vpsCount,
    dedicatedCount,
    domainCount,
    cdnCount,
    mrrAgg,
    revenueMonth,
    pendingInvoices,
    failedTopUps,
    openTickets,
    referralPending,
    nodes,
    provisioningQueue,
    systemHealth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.service.count({ where: { status: "ACTIVE" } }),
    prisma.service.count({ where: { type: "VPS", status: "ACTIVE" } }),
    prisma.service.count({ where: { type: "DEDICATED", status: "ACTIVE" } }),
    prisma.service.count({ where: { type: "DOMAIN", status: "ACTIVE" } }),
    prisma.service.count({ where: { type: "CDN", status: "ACTIVE" } }),
    prisma.service.aggregate({
      where: { status: "ACTIVE" },
      _sum: { monthlyPrice: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "PAYMENT", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.invoice.count({ where: { status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } } }),
    prisma.topUp.count({ where: { status: "FAILED" } }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "AWAITING_STAFF"] } } }),
    prisma.payoutRequest.count({ where: { status: "PENDING" } }),
    prisma.node.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        loadPercent: true,
        activeVps: true,
        capacityPercent: true,
      },
      orderBy: { loadPercent: "desc" },
      take: 8,
    }),
    prisma.provisioningJob.count({
      where: { status: { in: ["queued", "running", "failed", "retry"] } },
    }),
    prisma.node.aggregate({
      _avg: { loadPercent: true },
      where: { status: "online" },
    }),
  ]);

  const referralPaid = await prisma.referralEarning.aggregate({
    _sum: { amount: true },
    where: { createdAt: { gte: monthStart } },
  });

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      createdAt: true,
    },
  });

  const recentTickets = await prisma.ticket.findMany({
    where: { status: { in: ["OPEN", "AWAITING_STAFF"] } },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: {
      id: true,
      subject: true,
      priority: true,
      status: true,
      updatedAt: true,
    },
  });

  const dashboard: ControlDashboard = {
    kpis: {
      mrr: Number(mrrAgg._sum.monthlyPrice ?? 0),
      revenueMonth: Number(revenueMonth._sum.amount ?? 0),
      totalUsers,
      activeUsers30d,
      activeServices,
      vpsDeployed: vpsCount,
      dedicatedActive: dedicatedCount,
      domainsActive: domainCount,
      cdnZones: cdnCount,
      pendingInvoices,
      failedPayments: failedTopUps,
      referralPayoutsPending: referralPending,
      referralEarningsMonth: Number(referralPaid._sum.amount ?? 0),
      openTickets,
      provisioningQueue,
      avgNodeLoad: Number(systemHealth._avg.loadPercent ?? 0),
    },
    nodes,
    recentUsers,
    recentTickets,
    health: {
      status: avgNodeLoadSafe(systemHealth._avg.loadPercent) ? "healthy" : "degraded",
      avgLoad: Number(systemHealth._avg.loadPercent ?? 0),
    },
  };

  await cacheSet(cacheKey, dashboard, 120);
  return dashboard;
}

function avgNodeLoadSafe(load: number | null): boolean {
  return (load ?? 0) < 85;
}
