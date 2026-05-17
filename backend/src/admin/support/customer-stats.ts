import { prisma } from "@dior/database";

/** Lifetime paid top-ups + wallet snapshot for support staff */
export async function getTicketCustomerStats(userId: string) {
  const [user, topUps] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        balance: true,
        createdAt: true,
      },
    }),
    prisma.topUp.aggregate({
      where: { userId, status: "PAID" },
      _sum: { amount: true, netAmount: true },
      _count: { id: true },
    }),
  ]);

  if (!user) {
    return {
      balance: 0,
      topUpCount: 0,
      totalTopUpGross: 0,
      totalTopUpNet: 0,
    };
  }

  return {
    balance: Number(user.balance),
    topUpCount: topUps._count.id,
    /** Gross amount user paid in (before fees) */
    totalTopUpGross: Number(topUps._sum.amount ?? 0),
    /** Net credited to wallet after fees */
    totalTopUpNet: Number(topUps._sum.netAmount ?? 0),
  };
}
