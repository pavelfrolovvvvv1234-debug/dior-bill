import type { Prisma } from "@dior/database";

export function toJsonValue(
  value: Record<string, unknown> | unknown[] | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
