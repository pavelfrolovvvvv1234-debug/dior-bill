import { prisma } from "@dior/database";
import { requirePermission } from "../rbac";
import {
  referralStatsSourceUserFilter,
  topUpStatsUserFilter,
} from "../../lib/stats-exclusions";

export type PurchasePeriodStats = {
  topUps: number;
  topUpVolume: number;
  topUpNet: number;
  topUpFees: number;
  avgTopUp: number;
  failedTopUps: number;
  pendingTopUps: number;
  manualReviewTopUps: number;
  newUsers: number;
  usersWithLogin: number;
  emailVerifiedUsers: number;
  newServices: number;
  activeServices: number;
  serviceSpend: number;
  invoicesPaid: number;
  invoiceVolume: number;
  ticketsOpened: number;
  ticketsResolved: number;
  referralEarnings: number;
  payoutRequests: number;
  /** Gross top-up volume (legacy) */
  profit: number;
};

export type PurchaseStatistics = {
  generatedAt: string;
  last24Hours: PurchasePeriodStats;
  last7Days: PurchasePeriodStats;
  last30Days: PurchasePeriodStats;
  allTime: PurchasePeriodStats;
};

function sinceCreated(since: Date | null) {
  return since ? { createdAt: { gte: since } } : {};
}

function paidTopUpSince(since: Date | null) {
  const excluded = topUpStatsUserFilter();
  if (!since) {
    return { status: "PAID" as const, ...excluded };
  }
  return {
    status: "PAID" as const,
    ...excluded,
    OR: [
      { paidAt: { gte: since } },
      { paidAt: null, updatedAt: { gte: since } },
    ],
  };
}

function invoicePaidSince(since: Date | null) {
  if (!since) {
    return { status: "PAID" as const };
  }
  return {
    status: "PAID" as const,
    OR: [
      { paidAt: { gte: since } },
      { paidAt: null, updatedAt: { gte: since } },
    ],
  };
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

async function statsForPeriod(since: Date | null): Promise<PurchasePeriodStats> {
  const created = sinceCreated(since);
  const paidTopUp = paidTopUpSince(since);
  const loginSince = since ? { lastLoginAt: { gte: since } } : { lastLoginAt: { not: null } };

  const [
    topUps,
    topUpAgg,
    failedTopUps,
    pendingTopUps,
    manualReviewTopUps,
    newUsers,
    usersWithLogin,
    emailVerifiedUsers,
    newServices,
    activeServices,
    serviceSpendAgg,
    invoicesPaid,
    invoiceAgg,
    ticketsOpened,
    ticketsResolved,
    referralAgg,
    payoutRequests,
  ] = await Promise.all([
    prisma.topUp.count({ where: paidTopUp }),
    prisma.topUp.aggregate({
      where: paidTopUp,
      _sum: { amount: true, netAmount: true, fee: true },
      _avg: { amount: true },
    }),
    prisma.topUp.count({ where: { ...created, status: "FAILED" } }),
    prisma.topUp.count({
      where: { ...created, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.topUp.count({ where: { ...created, status: "MANUAL_REVIEW" } }),
    prisma.user.count({ where: created }),
    prisma.user.count({ where: loginSince }),
    prisma.user.count({
      where: {
        ...created,
        emailVerified: { not: null },
      },
    }),
    prisma.service.count({ where: created }),
    prisma.service.count({
      where: {
        ...created,
        status: "ACTIVE",
      },
    }),
    prisma.transaction.aggregate({
      where: {
        ...created,
        type: "PAYMENT",
      },
      _sum: { amount: true },
    }),
    prisma.invoice.count({ where: invoicePaidSince(since) }),
    prisma.invoice.aggregate({
      where: invoicePaidSince(since),
      _sum: { total: true },
    }),
    prisma.ticket.count({ where: created }),
    prisma.ticket.count({
      where: {
        ...created,
        status: { in: ["RESOLVED", "CLOSED"] },
      },
    }),
    prisma.referralEarning.aggregate({
      where: { ...created, ...referralStatsSourceUserFilter() },
      _sum: { amount: true },
    }),
    prisma.payoutRequest.count({
      where: {
        ...created,
        status: "PENDING",
      },
    }),
  ]);

  const topUpVolume = Number(topUpAgg._sum.amount ?? 0);
  const topUpNet = Number(topUpAgg._sum.netAmount ?? 0);
  const topUpFees = Number(topUpAgg._sum.fee ?? 0);
  const avgTopUp = topUps > 0 ? Number(topUpAgg._avg.amount ?? 0) : 0;

  return {
    topUps,
    topUpVolume: roundMoney(topUpVolume),
    topUpNet: roundMoney(topUpNet),
    topUpFees: roundMoney(topUpFees),
    avgTopUp: roundMoney(avgTopUp),
    failedTopUps,
    pendingTopUps,
    manualReviewTopUps,
    newUsers,
    usersWithLogin,
    emailVerifiedUsers,
    newServices,
    activeServices,
    serviceSpend: roundMoney(Number(serviceSpendAgg._sum.amount ?? 0)),
    invoicesPaid,
    invoiceVolume: roundMoney(Number(invoiceAgg._sum.total ?? 0)),
    ticketsOpened,
    ticketsResolved,
    referralEarnings: roundMoney(Number(referralAgg._sum.amount ?? 0)),
    payoutRequests,
    profit: roundMoney(topUpVolume),
  };
}

export async function getPurchaseStatistics(actorId: string): Promise<PurchaseStatistics> {
  await requirePermission(actorId, "analytics.read");

  const now = Date.now();
  const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [h24, d7, d30, all] = await Promise.all([
    statsForPeriod(last24Hours),
    statsForPeriod(last7Days),
    statsForPeriod(last30Days),
    statsForPeriod(null),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    last24Hours: h24,
    last7Days: d7,
    last30Days: d30,
    allTime: all,
  };
}
