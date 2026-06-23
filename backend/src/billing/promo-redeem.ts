import { prisma, type Prisma } from "@dior/database";
import { NotFoundError, ValidationError } from "@dior/shared";

export type PromoRow = {
  id: string;
  code: string;
  discountType: string;
  discountValue: { toNumber?: () => number } | number | string;
  maxUses: number | null;
  usedCount: number;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
};

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isPromoRedemptionConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export function validatePromoForUse(promo: PromoRow, now = new Date()): void {
  if (!promo.active) throw new NotFoundError("Invalid promo code");
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    throw new ValidationError("Promo code exhausted");
  }
  if (promo.validFrom && promo.validFrom > now) throw new ValidationError("Promo not yet valid");
  if (promo.validUntil && promo.validUntil < now) throw new ValidationError("Promo expired");
}

export function computeBalanceCredit(promo: Pick<PromoRow, "discountType" | "discountValue">): number {
  if (promo.discountType !== "fixed") {
    throw new ValidationError(
      "This promo code applies at checkout when placing an order",
    );
  }
  const credit = Number(promo.discountValue);
  if (credit <= 0) throw new ValidationError("Promo code has no value");
  return credit;
}

export function computeOrderDiscount(
  promo: Pick<PromoRow, "discountType" | "discountValue">,
  orderAmount: number,
): number {
  if (orderAmount <= 0) throw new ValidationError("Invalid order amount");
  if (promo.discountType !== "percent") {
    throw new ValidationError(
      "This promo code adds credit to your balance — apply it from Billing or the promo menu",
    );
  }
  const pct = Number(promo.discountValue);
  if (pct <= 0 || pct > 100) throw new ValidationError("Promo code has no value");
  const discount = orderAmount * (pct / 100);
  if (discount <= 0) throw new ValidationError("Promo code has no value");
  return Math.round(discount * 100) / 100;
}

export async function loadActivePromo(code: string): Promise<PromoRow> {
  const normalized = normalizePromoCode(code);
  if (!normalized) throw new ValidationError("Enter a promo code");
  const promo = await prisma.promoCode.findFirst({
    where: { code: normalized, active: true },
  });
  if (!promo) throw new NotFoundError("Invalid promo code");
  validatePromoForUse(promo);
  return promo;
}

export async function quoteOrderPromo(
  userId: string,
  code: string,
  orderAmount: number,
): Promise<{ code: string; discount: number; finalAmount: number; discountType: string }> {
  const promo = await loadActivePromo(code);
  await assertUserHasNotRedeemedPromo(userId, promo.id);
  const discount = computeOrderDiscount(promo, orderAmount);
  return {
    code: promo.code,
    discount,
    finalAmount: Math.max(0, Math.round((orderAmount - discount) * 100) / 100),
    discountType: promo.discountType,
  };
}

export async function finalizeOrderPromo(
  userId: string,
  promoId: string,
  discount: number,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const run = async (db: Prisma.TransactionClient) => {
    const promo = await db.promoCode.findUnique({ where: { id: promoId } });
    if (!promo) throw new NotFoundError("Invalid promo code");
    validatePromoForUse(promo);

    try {
      await db.promoCodeRedemption.create({
        data: { userId, promoCodeId: promoId, credit: discount },
      });
    } catch (err) {
      if (isPromoRedemptionConflict(err)) {
        throw new ValidationError("You have already used this promo code");
      }
      throw err;
    }

    const updated = await db.promoCode.updateMany({
      where: {
        id: promoId,
        active: true,
        usedCount: promo.maxUses ? { lt: promo.maxUses } : undefined,
      },
      data: { usedCount: { increment: 1 } },
    });
    if (updated.count === 0) {
      await db.promoCodeRedemption.deleteMany({
        where: { userId, promoCodeId: promoId },
      });
      throw new ValidationError("Promo code exhausted");
    }
  };

  if (tx) await run(tx);
  else await prisma.$transaction(run);
}

/** Undo a promo claim when payment fails after reservation. */
export async function releasePromoRedemption(
  userId: string,
  promoCodeId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const run = async (db: Prisma.TransactionClient) => {
    const deleted = await db.promoCodeRedemption.deleteMany({
      where: { userId, promoCodeId },
    });
    if (deleted.count > 0) {
      await db.promoCode.updateMany({
        where: { id: promoCodeId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
  };

  if (tx) await run(tx);
  else await prisma.$transaction(run);
}

export async function assertUserHasNotRedeemedPromo(
  userId: string,
  promoCodeId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  const existing = await db.promoCodeRedemption.findUnique({
    where: { userId_promoCodeId: { userId, promoCodeId } },
  });
  if (existing) {
    throw new ValidationError("You have already used this promo code");
  }
}

/** Apply percent promo to an order total; consumes the code after payment succeeds. */
export async function applyPromoToOrderTotal(
  userId: string,
  code: string | undefined,
  orderAmount: number,
): Promise<{
  chargeAmount: number;
  discount: number;
  promoCode?: string;
  promoId?: string;
}> {
  const trimmed = code?.trim();
  if (!trimmed) {
    return { chargeAmount: orderAmount, discount: 0 };
  }

  const promo = await loadActivePromo(trimmed);
  await assertUserHasNotRedeemedPromo(userId, promo.id);
  const discount = computeOrderDiscount(promo, orderAmount);
  const chargeAmount = Math.max(0, Math.round((orderAmount - discount) * 100) / 100);

  return {
    chargeAmount,
    discount,
    promoCode: promo.code,
    promoId: promo.id,
  };
}
