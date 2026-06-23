import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { toJsonValue } from "../lib/json";
import {
  assertUserHasNotRedeemedPromo,
  computeBalanceCredit,
  isPromoRedemptionConflict,
  loadActivePromo,
  normalizePromoCode,
  quoteOrderPromo,
} from "./promo-redeem";

export { applyPromoToOrderTotal, finalizeOrderPromo, quoteOrderPromo, releasePromoRedemption } from "./promo-redeem";

/** Quote discount for checkout — does not consume the promo. */
export async function applyPromoCode(userId: string, code: string, amount: number) {
  const quote = await quoteOrderPromo(userId, code, amount);
  return { discount: quote.discount, finalAmount: quote.finalAmount };
}

export async function redeemPromoCode(userId: string, code: string) {
  const normalized = normalizePromoCode(code);
  if (!normalized) throw new ValidationError("Enter a promo code");

  const promo = await loadActivePromo(normalized);
  const credit = computeBalanceCredit(promo);

  const credited = await prisma.$transaction(async (tx) => {
    try {
      await tx.promoCodeRedemption.create({
        data: {
          userId,
          promoCodeId: promo.id,
          credit,
        },
      });
    } catch (err) {
      if (isPromoRedemptionConflict(err)) {
        throw new ValidationError("You have already used this promo code");
      }
      throw err;
    }

    const updated = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        active: true,
        usedCount: promo.maxUses ? { lt: promo.maxUses } : undefined,
      },
      data: { usedCount: { increment: 1 } },
    });
    if (updated.count === 0) {
      await tx.promoCodeRedemption.deleteMany({
        where: { userId, promoCodeId: promo.id },
      });
      throw new ValidationError("Promo code exhausted");
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError();
    const newBalance = Number(user.balance) + credit;
    await tx.user.update({ where: { id: userId }, data: { balance: newBalance } });
    await tx.transaction.create({
      data: {
        userId,
        type: "CREDIT",
        amount: credit,
        balanceAfter: newBalance,
        description: `Promo code: ${promo.code}`,
        metadata: toJsonValue({ promoCodeId: promo.id, promoCode: promo.code }),
      },
    });
    return { credit, newBalance };
  });

  return {
    code: promo.code,
    credit: credited.credit,
    newBalance: credited.newBalance,
    discountType: promo.discountType,
  };
}

export async function topUpBalance(userId: string, amount: number, description: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError();
    const newBalance = Number(user.balance) + amount;
    await tx.user.update({ where: { id: userId }, data: { balance: newBalance } });
    await tx.transaction.create({
      data: {
        userId,
        type: "CREDIT",
        amount,
        balanceAfter: newBalance,
        description,
      },
    });
    return newBalance;
  });
}
