import { prisma } from "@dior/database";
import { toJsonValue } from "../../lib/json";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Worker-level deduplication. Same scope+key → same result, zero duplicate side effects.
 */
export async function withIdempotency<T>(
  scope: string,
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const existing = await prisma.processedIdempotencyKey.findUnique({
    where: { scope_key: { scope, key } },
  });
  if (existing?.result) {
    return existing.result as T;
  }

  const result = await fn();
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.processedIdempotencyKey.upsert({
    where: { scope_key: { scope, key } },
    create: {
      scope,
      key,
      result: toJsonValue(result as Record<string, unknown>),
      expiresAt,
    },
    update: {
      result: toJsonValue(result as Record<string, unknown>),
      expiresAt,
    },
  });

  return result;
}

export async function hasProcessed(scope: string, key: string): Promise<boolean> {
  const row = await prisma.processedIdempotencyKey.findUnique({
    where: { scope_key: { scope, key } },
  });
  return !!row;
}
