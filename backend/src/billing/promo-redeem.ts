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

export function validatePromoForUse(promo: PromoRow, now = new Date()): void {
  if (!promo.active) throw new NotFoundError("Invalid promo code");
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    throw new ValidationError("Promo code exhausted");
  }
  if (promo.validFrom && promo.validFrom > now) throw new ValidationError("Promo not yet valid");
  if (promo.validUntil && promo.validUntil < now) throw new ValidationError("Promo expired");
}

export function computePromoCredit(
  promo: Pick<PromoRow, "discountType" | "discountValue">,
  baseAmount?: number,
): number {
  let credit = 0;
  if (promo.discountType === "percent") {
    const base = baseAmount && baseAmount > 0 ? baseAmount : 100;
    credit = base * (Number(promo.discountValue) / 100);
  } else {
    credit = Number(promo.discountValue);
  }
  if (credit <= 0) throw new ValidationError("Promo code has no value");
  return credit;
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
