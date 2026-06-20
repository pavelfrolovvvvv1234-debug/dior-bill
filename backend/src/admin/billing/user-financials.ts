import { prisma, type Prisma } from "@dior/database";
import { requirePermission } from "../rbac";
import { toIso, toMoney } from "./serialize";

export async function getAdminUserFinancials(actorId: string, userId: string) {
  await requirePermission(actorId, "billing.read");

  const promoRedemptionsPromise = prisma.promoCodeRedemption
    .findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { promoCode: { select: { code: true, discountType: true } } },
    })
    .catch(() => [] as Array<{
      id: string;
      credit: Prisma.Decimal;
      createdAt: Date;
      promoCode: { code: string; discountType: string };
    }>);

  const [user, invoices, topUps, transactions, redemptions, payouts, referrals] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          balance: true,
          balanceLocked: true,
          credits: true,
          customReferralPercent: true,
        },
      }),
      prisma.invoice.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          dueAt: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      prisma.topUp.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          referenceCode: true,
          provider: true,
          status: true,
          amount: true,
          netAmount: true,
          createdAt: true,
        },
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          createdAt: true,
        },
      }),
      promoRedemptionsPromise,
      prisma.payoutRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, amount: true, status: true, method: true, createdAt: true },
      }),
      prisma.referralEarning.findMany({
        where: { earnerId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, amount: true, createdAt: true, sourceUserId: true },
      }),
    ]);

  return {
    wallet: {
      balance: toMoney(user?.balance),
      balanceLocked: toMoney(user?.balanceLocked),
      available: toMoney(user?.balance) - toMoney(user?.balanceLocked),
      credits: toMoney(user?.credits),
      customReferralPercent: user?.customReferralPercent
        ? toMoney(user.customReferralPercent)
        : null,
    },
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      total: toMoney(i.total),
      dueAt: toIso(i.dueAt),
      paidAt: toIso(i.paidAt),
      createdAt: toIso(i.createdAt)!,
    })),
    topUps: topUps.map((t) => ({
      id: t.id,
      referenceCode: t.referenceCode,
      provider: t.provider,
      status: t.status,
      amount: toMoney(t.amount),
      netAmount: toMoney(t.netAmount),
      createdAt: toIso(t.createdAt)!,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: toMoney(t.amount),
      balanceAfter: toMoney(t.balanceAfter),
      description: t.description,
      createdAt: toIso(t.createdAt)!,
    })),
    promoRedemptions: redemptions.map((r) => ({
      id: r.id,
      code: r.promoCode.code,
      discountType: r.promoCode.discountType,
      credit: toMoney(r.credit),
      createdAt: toIso(r.createdAt)!,
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: toMoney(p.amount),
      status: p.status,
      method: p.method,
      createdAt: toIso(p.createdAt)!,
    })),
    referralEarnings: referrals.map((r) => ({
      id: r.id,
      amount: toMoney(r.amount),
      sourceUserId: r.sourceUserId,
      createdAt: toIso(r.createdAt)!,
    })),
  };
}
