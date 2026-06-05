import { AppError } from "@dior/shared";
import { normalizePromoActionError } from "@/lib/promo-action-error";

/** Next.js production masks some server-action failures with this generic copy. */
function isNextProductionDigestError(message: string): boolean {
  return /Server Components render/i.test(message) || /digest property/i.test(message);
}

export function getServerActionErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (err instanceof AppError) {
    return err.message;
  }

  if (err instanceof Error) {
    const trimmed = err.message.trim();
    if (trimmed && !isNextProductionDigestError(trimmed)) {
      return trimmed;
    }
  }

  const promo = normalizePromoActionError(err);
  if (promo && promo !== "Could not apply promo code") {
    return promo;
  }

  return fallback;
}

/** Re-throw as a plain Error so the client receives a readable message in production. */
export function rethrowServerActionError(err: unknown, fallback?: string): never {
  throw new Error(getServerActionErrorMessage(err, fallback));
}
