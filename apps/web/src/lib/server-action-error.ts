import { AppError } from "@dior/shared";
import { normalizePromoActionError } from "@/lib/promo-action-error";

/** Next.js production masks some server-action failures with this generic copy. */
export function isNextProductionDigestError(message: string): boolean {
  return /Server Components render/i.test(message) || /digest property/i.test(message);
}

function extractErrorMessage(err: unknown): string | null {
  if (err instanceof AppError) {
    return err.message;
  }
  if (err instanceof Error) {
    const trimmed = err.message.trim();
    if (trimmed && !isNextProductionDigestError(trimmed)) {
      return trimmed;
    }
    const cause = err.cause;
    if (cause instanceof Error && cause.message.trim()) {
      return cause.message.trim();
    }
  }
  return null;
}

export function getServerActionErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  const direct = extractErrorMessage(err);
  if (direct) return direct;

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
