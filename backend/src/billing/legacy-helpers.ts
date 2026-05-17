import { prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";

export async function applyPromoCode(userId: string, code: string, amount: number) {
  const promo = await prisma.promoCode.findUnique({ where: { code, active: true } });
  if (!promo) throw new NotFoundError("Invalid promo code");
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    throw new ValidationError("Promo code exhausted");
  }
  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) throw new ValidationError("Promo not yet valid");
  if (promo.validUntil && promo.validUntil < now) throw new ValidationError("Promo expired");

  let discount = 0;
  if (promo.discountType === "percent") {
    discount = amount * (Number(promo.discountValue) / 100);
  } else {
    discount = Number(promo.discountValue);
  }

  await prisma.promoCode.update({
    where: { id: promo.id },
    data: { usedCount: { increment: 1 } },
  });

  return { discount, finalAmount: Math.max(0, amount - discount) };
}

export async function redeemPromoCode(userId: string, code: string, baseAmount?: number) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new ValidationError("Enter a promo code");

  const promo = await prisma.promoCode.findFirst({
    where: { code: normalized, active: true },
  });
  if (!promo) throw new NotFoundError("Invalid promo code");
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    throw new ValidationError("Promo code exhausted");
  }
  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) throw new ValidationError("Promo not yet valid");
  if (promo.validUntil && promo.validUntil < now) throw new ValidationError("Promo expired");

  let credit = 0;
  if (promo.discountType === "percent") {
    const base = baseAmount && baseAmount > 0 ? baseAmount : 100;
    credit = base * (Number(promo.discountValue) / 100);
  } else {
    credit = Number(promo.discountValue);
  }

  if (credit <= 0) throw new ValidationError("Promo code has no value");

  const credited = await prisma.$transaction(async (tx) => {
    const updated = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        active: true,
        usedCount: promo.maxUses ? { lt: promo.maxUses } : undefined,
      },
      data: { usedCount: { increment: 1 } },
    });
    if (updated.count === 0) throw new ValidationError("Promo code exhausted");

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
