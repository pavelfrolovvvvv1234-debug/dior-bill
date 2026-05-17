import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { prisma } from "@dior/database";
import { NotFoundError, UnauthorizedError, ValidationError } from "@dior/shared";
import { hashToken } from "../lib/crypto";
import { revokeSession, getActiveSessions, getLoginHistory } from "../auth";

export const API_PERMISSIONS = [
  "read:services",
  "write:vps",
  "billing",
  "domains",
  "cdn",
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];

const SUPPORTED_LOCALES = ["en", "ru", "zh", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function assertLocale(locale: string): SupportedLocale {
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    throw new ValidationError("Unsupported locale");
  }
  return locale as SupportedLocale;
}

async function verifyPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) throw new UnauthorizedError("Invalid credentials");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Current password is incorrect");
  return user;
}

function passwordStrength(password: string) {
  if (password.length < 10) throw new ValidationError("Password must be at least 10 characters");
  if (!/[A-Z]/.test(password)) throw new ValidationError("Include at least one uppercase letter");
  if (!/[a-z]/.test(password)) throw new ValidationError("Include at least one lowercase letter");
  if (!/[0-9]/.test(password)) throw new ValidationError("Include at least one number");
}

async function countRecoveryCodes(userId: string) {
  if (typeof prisma.twoFactorRecoveryCode?.count !== "function") return 0;
  return prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
}

async function listActiveApiKeys(userId: string) {
  if (typeof prisma.apiKey?.findMany !== "function") return [];
  return prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { auditLogs: true } } },
  });
}

/** Lightweight fetch for settings layout (locale only). */
export async function getSettingsLocale(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  if (!user) throw new NotFoundError();
  return user.locale;
}

export async function getSettingsProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPrefs: true },
  });
  if (!user) throw new NotFoundError();

  const recoveryRemaining = user.twoFactorEnabled ? await countRecoveryCodes(userId) : 0;

  const apiKeys = await listActiveApiKeys(userId);

  const categories = (user.notificationPrefs?.categories ?? {}) as Record<string, boolean>;

  return {
    id: user.id,
    email: user.email,
    locale: user.locale,
    timezone: user.timezone,
    twoFactorEnabled: user.twoFactorEnabled,
    recoveryCodesRemaining: recoveryRemaining,
    telegram: user.telegramId
      ? {
          id: user.telegramId.toString(),
          username: user.telegramUsername,
          avatarUrl: user.avatarUrl,
        }
      : null,
    telegramNotifications: {
      billing: categories.billing ?? true,
      abuse: categories.abuse ?? true,
      serverStatus: categories.server_status ?? true,
    },
    apiKeys: apiKeys.map((k) => ({
      id: k.id,
      label: k.label,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions as string[],
      rateLimitDay: k.rateLimitDay,
      requestsToday: k.requestsToday,
      lastUsedAt: k.lastUsedAt,
      lastUsedIp: k.lastUsedIp,
      createdAt: k.createdAt,
      auditCount: k._count.auditLogs,
    })),
  };
}

export async function updateProfile(userId: string, data: { email?: string }) {
  if (data.email) {
    const taken = await prisma.user.findFirst({
      where: { email: data.email, id: { not: userId } },
    });
    if (taken) throw new ValidationError("Email already in use");
  }
  return prisma.user.update({
    where: { id: userId },
    data: {
      email: data.email?.trim().toLowerCase() || undefined,
    },
    select: { id: true, email: true },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  await verifyPassword(userId, currentPassword);
  passwordStrength(newPassword);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function updateLocale(userId: string, locale: string) {
  assertLocale(locale);
  return prisma.user.update({
    where: { id: userId },
    data: { locale },
    select: { locale: true },
  });
}

export async function beginTwoFactorSetup(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError();
  if (user.twoFactorEnabled) throw new ValidationError("2FA is already enabled");

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(
    user.email ?? user.id,
    "DIOR.host",
    secret,
  );

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  });

  return { secret, otpauth };
}

export async function confirmTwoFactorSetup(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw new ValidationError("Start 2FA setup first");
  if (!authenticator.check(code.replace(/\s/g, ""), user.twoFactorSecret)) {
    throw new ValidationError("Invalid verification code");
  }

  await prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } });
  const recoveryCodes = await generateRecoveryCodes(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  });

  return { recoveryCodes };
}

async function generateRecoveryCodes(userId: string) {
  const plain: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(5).toString("hex").toUpperCase();
    plain.push(`${code.slice(0, 5)}-${code.slice(5)}`);
    const codeHash = hashToken(plain[i]!);
    await prisma.twoFactorRecoveryCode.create({
      data: { userId, codeHash },
    });
  }
  return plain;
}

export async function disableTwoFactor(
  userId: string,
  currentPassword: string,
  code?: string,
) {
  const user = await verifyPassword(userId, currentPassword);
  if (!user.twoFactorEnabled) return;

  if (user.twoFactorSecret && code) {
    const valid =
      authenticator.check(code.replace(/\s/g, ""), user.twoFactorSecret) ||
      (await consumeRecoveryCode(userId, code));
    if (!valid) throw new ValidationError("Invalid 2FA code");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } });
}

async function consumeRecoveryCode(userId: string, code: string) {
  const normalized = code.replace(/\s/g, "").toUpperCase();
  const rows = await prisma.twoFactorRecoveryCode.findMany({
    where: { userId, usedAt: null },
  });
  for (const row of rows) {
    if (hashToken(normalized) === row.codeHash || hashToken(code) === row.codeHash) {
      await prisma.twoFactorRecoveryCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}

export async function regenerateRecoveryCodes(userId: string, currentPassword: string) {
  const user = await verifyPassword(userId, currentPassword);
  if (!user.twoFactorEnabled) throw new ValidationError("Enable 2FA first");
  await prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } });
  return { recoveryCodes: await generateRecoveryCodes(userId) };
}

export async function createTelegramLinkToken(userId: string) {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.telegramLinkToken.create({
    data: { userId, token, expiresAt },
  });
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "DiorHostBot";
  return {
    token,
    expiresAt,
    deepLink: `https://t.me/${botUsername}?start=link_${token}`,
    botUrl: `https://t.me/${botUsername}`,
  };
}

/** Called by bot webhook or dev confirmation */
export async function completeTelegramLink(
  linkToken: string,
  telegram: { id: bigint; username?: string; photoUrl?: string },
) {
  const row = await prisma.telegramLinkToken.findUnique({
    where: { token: linkToken },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new ValidationError("Link expired or invalid");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: {
        telegramId: telegram.id,
        telegramUsername: telegram.username,
        avatarUrl: telegram.photoUrl ?? undefined,
      },
    }),
    prisma.telegramLinkToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { userId: row.userId };
}

export async function unlinkTelegram(userId: string, currentPassword: string) {
  await verifyPassword(userId, currentPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { telegramId: null, telegramUsername: null },
  });
}

export async function updateTelegramNotifications(
  userId: string,
  prefs: { billing?: boolean; abuse?: boolean; serverStatus?: boolean },
) {
  const categories = {
    billing: prefs.billing ?? true,
    abuse: prefs.abuse ?? true,
    server_status: prefs.serverStatus ?? true,
  };
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, categories },
    update: { categories },
  });
}

function assertPermissions(perms: string[]) {
  for (const p of perms) {
    if (!API_PERMISSIONS.includes(p as ApiPermission)) {
      throw new ValidationError(`Invalid permission: ${p}`);
    }
  }
}

export async function createApiKey(
  userId: string,
  label: string,
  permissions: string[],
  currentPassword: string,
) {
  await verifyPassword(userId, currentPassword);
  assertPermissions(permissions);
  if (!label.trim()) throw new ValidationError("Label is required");

  const rawKey = `dior_${randomBytes(24).toString("hex")}`;
  const keyHash = hashToken(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  const key = await prisma.apiKey.create({
    data: {
      userId,
      label: label.trim(),
      keyPrefix,
      keyHash,
      permissions,
    },
  });

  return { id: key.id, label: key.label, key: rawKey, keyPrefix, permissions };
}

export async function revokeApiKey(userId: string, keyId: string, currentPassword: string) {
  await verifyPassword(userId, currentPassword);
  await prisma.apiKey.updateMany({
    where: { id: keyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function rotateApiKey(
  userId: string,
  keyId: string,
  currentPassword: string,
) {
  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, userId, revokedAt: null },
  });
  if (!existing) throw new NotFoundError();

  await revokeApiKey(userId, keyId, currentPassword);
  return createApiKey(
    userId,
    `${existing.label} (rotated)`,
    existing.permissions as string[],
    currentPassword,
  );
}

export async function getApiKeyAuditLogs(userId: string, keyId: string, limit = 50) {
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  });
  if (!key) throw new NotFoundError();

  return prisma.apiKeyAuditLog.findMany({
    where: { apiKeyId: keyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function revokeSessionWithAuth(
  userId: string,
  sessionId: string,
  currentPassword: string,
) {
  await verifyPassword(userId, currentPassword);
  return revokeSession(sessionId, userId);
}

export { getActiveSessions, getLoginHistory, revokeSession };
export * from "./api-auth";
