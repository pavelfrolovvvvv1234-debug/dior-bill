import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";
import { toJsonValue } from "../lib/json";
import {
  assertUserHasNotRedeemedPromo,
  computePromoCredit,
  normalizePromoCode,
  validatePromoForUse,
} from "./promo-redeem";

/** Quote discount for checkout — does not consume the promo (see redeemPromoCode). */
export async function applyPromoCode(userId: string, code: string, amount: number) {
  const normalized = normalizePromoCode(code);
  const promo = await prisma.promoCode.findFirst({
    where: { code: normalized, active: true },
  });
  if (!promo) throw new NotFoundError("Invalid promo code");
  validatePromoForUse(promo);
  await assertUserHasNotRedeemedPromo(userId, promo.id);

  let discount = 0;
  if (promo.discountType === "percent") {
    discount = amount * (Number(promo.discountValue) / 100);
  } else {
    discount = Number(promo.discountValue);
  }

  return { discount, finalAmount: Math.max(0, amount - discount) };
}

export async function redeemPromoCode(userId: string, code: string, baseAmount?: number) {
  const normalized = normalizePromoCode(code);
  if (!normalized) throw new ValidationError("Enter a promo code");

  const promo = await prisma.promoCode.findFirst({
    where: { code: normalized, active: true },
  });
  if (!promo) throw new NotFoundError("Invalid promo code");
  validatePromoForUse(promo);
  await assertUserHasNotRedeemedPromo(userId, promo.id);

  const credit = computePromoCredit(promo, baseAmount);

  const credited = await prisma.$transaction(async (tx) => {
    await assertUserHasNotRedeemedPromo(userId, promo.id, tx);

    const updated = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        active: true,
        usedCount: promo.maxUses ? { lt: promo.maxUses } : undefined,
      },
      data: { usedCount: { increment: 1 } },
    });
    if (updated.count === 0) throw new ValidationError("Promo code exhausted");

    await tx.promoCodeRedemption.create({
      data: {
        userId,
        promoCodeId: promo.id,
        credit,
      },
    });

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
