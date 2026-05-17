import { prisma } from "@dior/database";
import { UnauthorizedError } from "@dior/shared";
import { hashToken } from "../lib/crypto";
import type { ApiPermission } from "./index";

export type AuthenticatedApiKey = {
  id: string;
  userId: string;
  label: string;
  permissions: ApiPermission[];
  rateLimitDay: number;
  requestsToday: number;
};

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function authenticateApiKey(
  rawKey: string | null | undefined,
): Promise<AuthenticatedApiKey | null> {
  if (!rawKey?.startsWith("dior_")) return null;

  const keyHash = hashToken(rawKey);
  const row = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
  });
  if (!row) return null;

  const dayStart = startOfUtcDay();
  if (row.requestsReset < dayStart) {
    await prisma.apiKey.update({
      where: { id: row.id },
      data: { requestsToday: 0, requestsReset: new Date() },
    });
    row.requestsToday = 0;
  }

  if (row.requestsToday >= row.rateLimitDay) {
    throw new UnauthorizedError("API rate limit exceeded");
  }

  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    permissions: row.permissions as ApiPermission[],
    rateLimitDay: row.rateLimitDay,
    requestsToday: row.requestsToday,
  };
}

export function assertApiPermission(key: AuthenticatedApiKey, permission: ApiPermission) {
  if (!key.permissions.includes(permission)) {
    throw new UnauthorizedError(`Missing permission: ${permission}`);
  }
}

export async function recordApiKeyUsage(
  keyId: string,
  meta: { method: string; path: string; ipAddress: string; statusCode: number },
) {
  await prisma.$transaction([
    prisma.apiKey.update({
      where: { id: keyId },
      data: {
        requestsToday: { increment: 1 },
        lastUsedAt: new Date(),
        lastUsedIp: meta.ipAddress,
      },
    }),
    prisma.apiKeyAuditLog.create({
      data: {
        apiKeyId: keyId,
        method: meta.method,
        path: meta.path,
        ipAddress: meta.ipAddress,
        statusCode: meta.statusCode,
      },
    }),
  ]);
}
