import { Prisma } from "@dior/database";

export function normalizePromoActionError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2021" || err.code === "P2022") {
      return "PROMO_DB_NOT_READY";
    }
  }

  const message = err instanceof Error ? err.message : "";
  if (/promo_code_redemptions/i.test(message) && /does not exist/i.test(message)) {
    return "PROMO_DB_NOT_READY";
  }

  if (err instanceof Error && message.trim()) {
    return message;
  }

  return "Could not apply promo code";
}
