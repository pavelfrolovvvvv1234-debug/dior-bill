import { prisma } from "@dior/database";
import { cacheGet, cacheSet } from "../lib/redis";
import { requirePermission } from "./rbac";

export type ControlDashboard = {
  kpis: {
    revenueMonth: number;
    topUpsPaidMonth: number;
    topUpsPaidMonthAmount: number;
    topUpsAwaiting: number;
    failedTopUps: number;
    totalUsers: number;
    activeUsers30d: number;
    activeServices: number;
    openTickets: number;
  };
  recentTopUps: Array<{
    id: string;
    referenceCode: string;
    amount: number;
    status: string;
    provider: string;
    createdAt: Date;
    user: { email: string | null; telegramUsername: string | null };
  }>;
  recentUsers: Array<{
    id: string;
    email: string | null;
    status: string;
    createdAt: Date;
  }>;
  recentServices: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    createdAt: Date;
    user: { email: string | null };
  }>;
  recentTickets: Array<{
    id: string;
    subject: string;
    priority: string;
    status: string;
    updatedAt: Date;
  }>;
};

export async function getControlDashboard(actorId: string): Promise<ControlDashboard> {
  await requirePermission(actorId, "analytics.read");

  const cacheKey = "control:dashboard:v2";
  const cached = await cacheGet<ControlDashboard>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers30d,
    activeServices,
    revenueMonth,
    topUpsPaidMonth,
    topUpsPaidMonthAmount,
    topUpsAwaiting,
    failedTopUps,
    openTickets,
    recentTopUps,
    recentUsers,
    recentServices,
    recentTickets,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: activeSince } } }),
    prisma.service.count({ where: { status: "ACTIVE" } }),
    prisma.transaction.aggregate({
      where: { type: "PAYMENT", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.topUp.count({
      where: { status: "PAID", paidAt: { gte: monthStart } },
    }),
    prisma.topUp.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.topUp.count({
      where: { status: { in: ["PENDING", "PROCESSING", "MANUAL_REVIEW"] } },
    }),
    prisma.topUp.count({ where: { status: "FAILED" } }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "AWAITING_STAFF"] } } }),
    prisma.topUp.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        referenceCode: true,
        amount: true,
        status: true,
        provider: true,
        createdAt: true,
        user: { select: { email: true, telegramUsername: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, email: true, status: true, createdAt: true },
    }),
    prisma.service.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        type: true,
        label: true,
        status: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { status: { in: ["OPEN", "AWAITING_STAFF"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, subject: true, priority: true, status: true, updatedAt: true },
    }),
  ]);

  const dashboard: ControlDashboard = {
    kpis: {
      revenueMonth: Number(revenueMonth._sum.amount ?? 0),
      topUpsPaidMonth,
      topUpsPaidMonthAmount: Number(topUpsPaidMonthAmount._sum.amount ?? 0),
      topUpsAwaiting,
      failedTopUps,
      totalUsers,
      activeUsers30d,
      activeServices,
      openTickets,
    },
    recentTopUps: recentTopUps.map((t) => ({
      ...t,
      amount: Number(t.amount),
    })),
    recentUsers,
    recentServices,
    recentTickets,
  };

  await cacheSet(cacheKey, dashboard, 120);
  return dashboard;
}
