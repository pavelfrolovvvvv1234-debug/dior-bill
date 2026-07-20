import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { invalidateControlDashboardCache } from "../../admin/dashboard";
import { toJsonValue } from "../../lib/json";
import { invalidateUserDashboardCache } from "../../users";

/**
 * Void a paid top-up: mark REFUNDED, claw back wallet credit, reverse referral commission.
 * Used for internal/test accounts that should not count in revenue stats.
 */
export async function voidPaidTopUp(
  topUpId: string,
  options?: { reason?: string; actorId?: string },
) {
  const updated = await prisma.$transaction(async (tx) => {
    const topUp = await tx.topUp.findUnique({ where: { id: topUpId } });
    if (!topUp) throw new NotFoundError("Top-up not found");
    if (topUp.status === "REFUNDED") return topUp;
    if (topUp.status !== "PAID") {
      throw new ValidationError("Only PAID top-ups can be voided");
    }

    const creditAmount = Number(topUp.netAmount);
    const user = await tx.user.findUnique({ where: { id: topUp.userId } });
    if (!user) throw new NotFoundError("User not found");

    const newBalance = Number(user.balance) - creditAmount;
    await tx.user.update({
      where: { id: topUp.userId },
      data: { balance: newBalance },
    });

    await tx.transaction.create({
      data: {
        userId: topUp.userId,
        type: "ADJUSTMENT",
        amount: creditAmount,
        balanceAfter: newBalance,
        description: `Void top-up ${topUp.referenceCode}`,
        metadata: toJsonValue({ topUpId: topUp.id, void: true }),
      },
    });

    if (topUp.paidAt) {
      const windowStart = new Date(topUp.paidAt.getTime() - 2 * 60 * 1000);
      const windowEnd = new Date(topUp.paidAt.getTime() + 2 * 60 * 1000);
      const earnings = await tx.referralEarning.findMany({
        where: {
          sourceUserId: topUp.userId,
          createdAt: { gte: windowStart, lte: windowEnd },
        },
      });

      for (const earning of earnings) {
        await tx.user.update({
          where: { id: earning.earnerId },
          data: { balance: { decrement: Number(earning.amount) } },
        });
        await tx.referralEarning.delete({ where: { id: earning.id } });
      }
    }

    const result = await tx.topUp.update({
      where: { id: topUpId },
      data: {
        status: "REFUNDED",
        adminNotes: options?.reason ?? "Voided — excluded from statistics",
        reviewedById: options?.actorId,
        reviewedAt: new Date(),
      },
    });

    await tx.topUpEvent.create({
      data: {
        topUpId,
        event: "voided",
        payload: toJsonValue({
          creditAmount,
          reason: options?.reason ?? "excluded from statistics",
          actorId: options?.actorId,
        }),
      },
    });

    return result;
  });

  await Promise.all([
    invalidateControlDashboardCache().catch(() => undefined),
    invalidateUserDashboardCache(updated.userId).catch(() => undefined),
  ]);

  return updated;
}
