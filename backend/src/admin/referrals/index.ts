import { prisma } from "@dior/database";
import type { PayoutStatus } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { eligibleReferralWhere } from "../../referrals/eligibility";
import { requirePermission } from "../rbac";

export async function getReferralOverview(actorId: string) {
  await requirePermission(actorId, "referrals.read");

  const [totalEarnings, pendingPayouts, vipAffiliates, topEarners] = await Promise.all([
    prisma.referralEarning.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.payoutRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "AFFILIATE_VIP" } }),
    prisma.referralEarning.groupBy({
      by: ["earnerId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
  ]);

  const earnerIds = topEarners.map((e) => e.earnerId);
  const users = await prisma.user.findMany({
    where: { id: { in: earnerIds } },
    select: { id: true, email: true, referralCode: true, customReferralPercent: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return {
    totalEarnings: Number(totalEarnings._sum.amount ?? 0),
    transactionCount: totalEarnings._count,
    pendingPayouts,
    vipAffiliates,
    topEarners: topEarners.map((e) => ({
      user: userMap[e.earnerId],
      earnings: Number(e._sum.amount ?? 0),
    })),
  };
}

export async function listPayoutRequests(
  actorId: string,
  options: { status?: PayoutStatus; page?: number; pageSize?: number } = {},
) {
  await requirePermission(actorId, "referrals.read");

  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 20, 100);
  const where = { ...(options.status && { status: options.status }) };

  const [items, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, referralCode: true } },
      },
    }),
    prisma.payoutRequest.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function updatePayoutStatus(
  actorId: string,
  payoutId: string,
  status: PayoutStatus,
  notes?: string,
) {
  await requirePermission(actorId, "referrals.write");

  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) throw new NotFoundError();

  const updated = await prisma.payoutRequest.update({
    where: { id: payoutId },
    data: { status, notes },
  });

  await createAuditLog({
    actorId,
    action: `payout.${status.toLowerCase()}`,
    entityType: "payout_request",
    entityId: payoutId,
    metadata: { userId: payout.userId, amount: Number(payout.amount) },
  });

  return updated;
}

export async function listReferralTree(actorId: string, userId: string) {
  await requirePermission(actorId, "referrals.read");

  const [user, referrals, earnings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        referralCode: true,
        referredBy: { select: { id: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: await eligibleReferralWhere(userId),
      select: {
        id: true,
        email: true,
        createdAt: true,
        status: true,
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.referralEarning.findMany({
      where: { earnerId: userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { sourceUser: { select: { email: true } } },
    }),
  ]);
  if (!user) throw new NotFoundError();

  return { user: { ...user, referrals }, earnings };
}
