import { prisma, type Prisma } from "@dior/database";
import { toJsonValue } from "../lib/json";
import {
  buildReferralLink,
  DEFAULT_REFERRAL_PERCENT,
  NotFoundError,
  ValidationError,
} from "@dior/shared";
import { eligibleReferralWhere, hasReferralQualifiesColumn, isEligibleReferral } from "./eligibility";
import { isStatsExcludedTelegramUsername } from "../lib/stats-exclusions";

export { resolveReferrerId, type ReferrerResolution } from "./resolve-referrer";
export {
  isEligibleReferral,
  eligibleReferralWhere,
  countEligibleReferralsByReferrer,
  hasReferralQualifiesColumn,
} from "./eligibility";

export async function getReferralDashboard(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { affiliateTier: true },
  });
  if (!user) throw new NotFoundError();

  const [referrals, earnings, payouts, recentEarnings] = await Promise.all([
    prisma.user.findMany({
      where: await eligibleReferralWhere(userId),
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
        telegramUsername: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.referralEarning.aggregate({
      where: { earnerId: userId },
      _sum: { amount: true },
    }),
    prisma.payoutRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.referralEarning.findMany({
      where: { earnerId: userId },
      include: {
        sourceUser: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const percent =
    Number(user.customReferralPercent) ||
    Number(user.affiliateTier?.percent) ||
    DEFAULT_REFERRAL_PERCENT;

  const earningsByReferral = await Promise.all(
    referrals.map(async (ref) => {
      const sum = await prisma.referralEarning.aggregate({
        where: { earnerId: userId, sourceUserId: ref.id },
        _sum: { amount: true },
      });
      return { ...ref, totalEarned: Number(sum._sum.amount ?? 0) };
    }),
  );

  return {
    referralCode: user.referralCode,
    referralLink: buildReferralLink(
      user.referralCode,
      (process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://dior.host").replace(/\/$/, ""),
    ),
    tier: user.affiliateTier,
    percent,
    totalEarnings: Number(earnings._sum.amount ?? 0),
    referralCount: referrals.length,
    referrals: earningsByReferral,
    recentEarnings,
    payouts,
  };
}

export async function processReferralCommission(
  payerUserId: string,
  paymentAmount: number,
  invoiceId?: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  const hasColumn = await hasReferralQualifiesColumn();
  const payer = await db.user.findUnique({
    where: { id: payerUserId },
    select: {
      referredById: true,
      telegramUsername: true,
      ...(hasColumn ? { referralQualifies: true } : {}),
    },
  });
  if (!payer?.referredById || !isEligibleReferral(payer, hasColumn)) return;
  if (isStatsExcludedTelegramUsername(payer.telegramUsername)) return;

  const earner = await db.user.findUnique({
    where: { id: payer.referredById },
    include: { affiliateTier: true },
  });
  if (!earner) return;

  const percent =
    Number(earner.customReferralPercent) ||
    Number(earner.affiliateTier?.percent) ||
    DEFAULT_REFERRAL_PERCENT;
  const amount = (paymentAmount * percent) / 100;

  await db.referralEarning.create({
    data: {
      earnerId: earner.id,
      sourceUserId: payerUserId,
      amount,
      invoiceId,
      description: `Commission from payment`,
    },
  });

  await db.user.update({
    where: { id: earner.id },
    data: { balance: { increment: amount } },
  });
}

export async function requestPayout(
  userId: string,
  amount: number,
  method: string,
  details?: Record<string, unknown>,
) {
  const earnings = await prisma.referralEarning.aggregate({
    where: { earnerId: userId },
    _sum: { amount: true },
  });
  const paid = await prisma.payoutRequest.aggregate({
    where: { userId, status: { in: ["PENDING", "APPROVED", "PAID"] } },
    _sum: { amount: true },
  });
  const available = Number(earnings._sum.amount ?? 0) - Number(paid._sum.amount ?? 0);
  if (amount > available) throw new ValidationError("Insufficient referral balance");

  return prisma.payoutRequest.create({
    data: { userId, amount, method, details: toJsonValue(details) },
  });
}

export async function getAffiliateTiers() {
  return prisma.affiliateTier.findMany({ orderBy: { minReferrals: "asc" } });
}
