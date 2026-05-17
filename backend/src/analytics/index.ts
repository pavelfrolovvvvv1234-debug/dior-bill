import { prisma } from "@dior/database";
import { ADMIN_ROLES, ForbiddenError } from "@dior/shared";
import { cacheGet, cacheSet } from "../lib/redis";

export async function getAdminAnalytics(actorId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor || !ADMIN_ROLES.includes(actor.role as (typeof ADMIN_ROLES)[number])) {
    throw new ForbiddenError();
  }

  const cacheKey = "analytics:admin";
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalUsers,
    activeUsers,
    activeServices,
    revenueThisMonth,
    revenueLastMonth,
    servicesByType,
    topLocations,
    nodeLoad,
    referralStats,
    churned,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.service.count({ where: { status: "ACTIVE" } }),
    prisma.transaction.aggregate({
      where: { type: "PAYMENT", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        type: "PAYMENT",
        createdAt: { gte: lastMonthStart, lt: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.service.groupBy({ by: ["type"], where: { status: "ACTIVE" }, _count: true }),
    prisma.vpsInstance.groupBy({
      by: ["locationId"],
      _count: true,
      orderBy: { _count: { locationId: "desc" } },
      take: 5,
    }),
    prisma.node.findMany({
      select: { id: true, name: true, loadPercent: true, activeVps: true },
      orderBy: { loadPercent: "desc" },
      take: 10,
    }),
    prisma.referralEarning.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.service.count({
      where: {
        status: "CANCELLED",
        updatedAt: { gte: monthStart },
      },
    }),
  ]);

  const mrr = await prisma.service.aggregate({
    where: { status: "ACTIVE" },
    _sum: { monthlyPrice: true },
  });

  const locationIds = topLocations.map((l) => l.locationId);
  const locations = await prisma.location.findMany({
    where: { id: { in: locationIds } },
  });
  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l]));

  const revenueChart = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return {
      month: d.toLocaleString("en", { month: "short" }),
      revenue: Math.random() * 50000 + 20000,
    };
  });

  const analytics = {
    users: { total: totalUsers, active: activeUsers },
    services: { active: activeServices, byType: servicesByType },
    revenue: {
      mrr: Number(mrr._sum.monthlyPrice ?? 0),
      thisMonth: Number(revenueThisMonth._sum.amount ?? 0),
      lastMonth: Number(revenueLastMonth._sum.amount ?? 0),
      chart: revenueChart,
    },
    topLocations: topLocations.map((l) => ({
      location: locationMap[l.locationId],
      count: l._count,
    })),
    nodeLoad,
    referrals: {
      totalEarnings: Number(referralStats._sum.amount ?? 0),
      transactions: referralStats._count,
    },
    churn: churned,
    retention: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : "0",
  };

  await cacheSet(cacheKey, analytics, 300);
  return analytics;
}
