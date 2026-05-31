import { prisma } from "@dior/database";
import { requirePermission } from "../rbac";
import { toMoney } from "./serialize";

export async function getAdminBillingOverview(actorId: string) {
  await requirePermission(actorId, "billing.read");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    pendingInvoices,
    overdueInvoices,
    paidInvoicesMonth,
    topUpStats,
    failedTopUps,
    pendingTopUps,
    manualReviewTopUps,
    transactionVolumeMonth,
    lockedBalanceAgg,
    reconciliationRecent,
  ] = await Promise.all([
    prisma.invoice.count({ where: { status: "PENDING" } }),
    prisma.invoice.count({
      where: { status: "PENDING", dueAt: { lt: now } },
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.topUp.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amount: true, netAmount: true },
    }),
    prisma.topUp.count({ where: { status: "FAILED" } }),
    prisma.topUp.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.topUp.count({ where: { status: "MANUAL_REVIEW" } }),
    prisma.transaction.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.user.aggregate({ _sum: { balanceLocked: true, balance: true } }),
    prisma.reconciliationRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);

  const paidTopUps = topUpStats.find((s) => s.status === "PAID");
  const providerBreakdown = await prisma.topUp.groupBy({
    by: ["provider"],
    where: { status: "PAID", paidAt: { gte: monthStart } },
    _sum: { netAmount: true },
    _count: true,
  });

  return {
    invoices: {
      pending: pendingInvoices,
      overdue: overdueInvoices,
      paidThisMonth: paidInvoicesMonth._count,
      revenueThisMonth: toMoney(paidInvoicesMonth._sum.total),
    },
    topUps: {
      failed: failedTopUps,
      pending: pendingTopUps,
      manualReview: manualReviewTopUps,
      paidCount: paidTopUps?._count ?? 0,
      paidVolume: toMoney(paidTopUps?._sum.amount),
      paidNet: toMoney(paidTopUps?._sum.netAmount),
      byStatus: topUpStats.map((s) => ({
        status: s.status,
        count: s._count,
        volume: toMoney(s._sum.amount),
      })),
    },
    ledger: {
      transactionCountMonth: transactionVolumeMonth._count,
      transactionVolumeMonth: toMoney(transactionVolumeMonth._sum.amount),
    },
    wallet: {
      totalBalance: toMoney(lockedBalanceAgg._sum.balance),
      totalLocked: toMoney(lockedBalanceAgg._sum.balanceLocked),
    },
    providers: providerBreakdown.map((p) => ({
      provider: p.provider,
      count: p._count,
      netAmount: toMoney(p._sum.netAmount),
    })),
    recentReconciliation: reconciliationRecent.map((r) => ({
      id: r.id,
      domain: r.domain,
      status: r.status,
      fixesApplied: r.fixesApplied,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  };
}
