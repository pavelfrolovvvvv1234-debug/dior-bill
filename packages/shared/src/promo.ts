import { ValidationError } from "./errors";

export const PROMO_DISCOUNT_TYPES = ["percent", "fixed"] as const;
export type PromoDiscountType = (typeof PROMO_DISCOUNT_TYPES)[number];

export function isPromoDiscountType(value: string): value is PromoDiscountType {
  return (PROMO_DISCOUNT_TYPES as readonly string[]).includes(value);
}

export function formatPromoTypeLabel(type: string): string {
  if (type === "percent") return "Order discount (%)";
  if (type === "fixed") return "Balance credit ($)";
  return type;
}

export function formatPromoValue(type: string, value: number): string {
  if (type === "percent") return `${value}% off orders`;
  if (type === "fixed") return `$${value} to balance`;
  return String(value);
}

export function validatePromoCreateInput(data: {
  code: string;
  discountType: string;
  discountValue: number;
  maxUses?: number;
}): { code: string; discountType: PromoDiscountType; discountValue: number; maxUses?: number } {
  const code = data.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw new ValidationError("Code must be 3–32 characters (letters, numbers, _ or -)");
  }
  if (!isPromoDiscountType(data.discountType)) {
    throw new ValidationError("Invalid promo type");
  }
  const discountValue = Number(data.discountValue);
  if (!Number.isFinite(discountValue)) {
    throw new ValidationError("Invalid value");
  }
  if (data.discountType === "percent") {
    if (discountValue <= 0 || discountValue > 100) {
      throw new ValidationError("Percent discount must be between 1 and 100");
    }
  } else if (discountValue <= 0) {
    throw new ValidationError("Balance credit must be greater than 0");
  }
  if (data.maxUses != null) {
    const maxUses = Number(data.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      throw new ValidationError("Max uses must be a positive integer");
    }
  }
  return {
    code,
    discountType: data.discountType,
    discountValue,
    maxUses: data.maxUses != null ? Number(data.maxUses) : undefined,
  };
}
