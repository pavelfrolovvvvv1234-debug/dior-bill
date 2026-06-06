import bcrypt from "bcryptjs";
import { prisma } from "@dior/database";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  generateReferralCode,
  RATE_LIMITS,
  validateRegistrationEmail,
  validateRegistrationPassword,
} from "@dior/shared";
import { createAuditLog } from "../audit";
import { resolveReferrerId } from "../referrals/resolve-referrer";
import { hashToken } from "../lib/crypto";
import { checkRateLimit } from "../lib/rate-limit";
import { createSessionToken } from "../lib/session";
import { releaseStuckAbuseRestrictions } from "../core/abuse/engine";
import { randomBytes } from "crypto";

export interface RegisterInput {
  email: string;
  password: string;
  referralCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
}

export interface TelegramAuthInput {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
  referralCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

function validateTelegramAuth(data: TelegramAuthInput): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - data.auth_date > 86_400) return false;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return process.env.NODE_ENV === "development";
  const crypto = require("crypto") as typeof import("crypto");
  const { hash, referralCode: _ref, ipAddress: _ip, userAgent: _ua, ...rest } = data;
  const checkString = Object.keys(rest)
    .filter((k) => rest[k as keyof typeof rest] !== undefined && rest[k as keyof typeof rest] !== "")
    .sort()
    .map((k) => `${k}=${rest[k as keyof typeof rest]}`)
    .join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  return hmac === hash;
}

async function createSessionForUser(
  userId: string,
  role: string,
  ipAddress?: string,
  userAgent?: string,
  deviceId?: string,
  deviceName?: string,
) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
      deviceLabel: deviceName,
    },
  });

  if (deviceId) {
    await prisma.deviceSession.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: {
        userId,
        deviceId,
        deviceName,
        ipAddress,
        lastSeenAt: new Date(),
      },
      update: { lastSeenAt: new Date(), ipAddress },
    });
  }

  const jwt = await createSessionToken({
    userId,
    sessionId: session.id,
    role,
  });

  return { session, token: jwt, rawToken };
}

export async function register(input: RegisterInput) {
  const rateKey = `register:${input.ipAddress ?? "unknown"}`;
  const { allowed } = await checkRateLimit(
    rateKey,
    RATE_LIMITS.REGISTER.max,
    RATE_LIMITS.REGISTER.windowMs,
  );
  if (!allowed) throw new ValidationError("Too many registration attempts");

  const email = validateRegistrationEmail(input.email);
  validateRegistrationPassword(input.password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email already registered");

  const referral = await resolveReferrerId(input.referralCode);

  let referralCode = generateReferralCode();
  while (await prisma.user.findUnique({ where: { referralCode } })) {
    referralCode = generateReferralCode();
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      referralCode,
      referredById: referral.referredById,
      lastOnlineAt: new Date(),
    },
  });

  await prisma.notificationPreference.create({ data: { userId: user.id } });

  const { token } = await createSessionForUser(
    user.id,
    user.role,
    input.ipAddress,
    input.userAgent,
  );

  await createAuditLog({
    actorId: user.id,
    action: "user.register",
    entityType: "user",
    entityId: user.id,
    ipAddress: input.ipAddress,
    metadata: referral.normalizedCode
      ? {
          referralCode: referral.normalizedCode,
          referralAttributed: referral.attributed,
          referrerId: referral.referredById ?? null,
        }
      : undefined,
  });

  return { user, token };
}

export async function login(input: LoginInput) {
  const rateKey = `login:${input.email}`;
  const { allowed } = await checkRateLimit(
    rateKey,
    RATE_LIMITS.LOGIN.max,
    RATE_LIMITS.LOGIN.windowMs,
  );
  if (!allowed) throw new ValidationError("Too many login attempts");

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const success = !!(user?.passwordHash && (await bcrypt.compare(input.password, user.passwordHash)));

  if (user) {
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: input.ipAddress ?? "0.0.0.0",
        userAgent: input.userAgent,
        success,
        method: "email",
      },
    });
  }

  if (!user || !success) throw new UnauthorizedError("Invalid credentials");
  if (user.status !== "ACTIVE") throw new UnauthorizedError("Account suspended");

  await releaseStuckAbuseRestrictions(user.id);

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: now, lastLoginIp: input.ipAddress, lastOnlineAt: now },
  });

  const { token } = await createSessionForUser(
    user.id,
    user.role,
    input.ipAddress,
    input.userAgent,
    input.deviceId,
    input.deviceName,
  );

  await createAuditLog({
    actorId: user.id,
    action: "user.login",
    entityType: "user",
    entityId: user.id,
    ipAddress: input.ipAddress,
  });

  return { user, token };
}

export async function loginWithTelegram(input: TelegramAuthInput) {
  if (!validateTelegramAuth(input)) {
    throw new UnauthorizedError("Invalid Telegram authentication");
  }

  const telegramId = BigInt(input.id);
  let user = await prisma.user.findUnique({ where: { telegramId } });
  const isNewUser = !user;

  if (!user) {
    const referral = await resolveReferrerId(input.referralCode);

    let referralCode = generateReferralCode();
    while (await prisma.user.findUnique({ where: { referralCode } })) {
      referralCode = generateReferralCode();
    }

    const displayName = [input.first_name, input.last_name].filter(Boolean).join(" ") || undefined;

    user = await prisma.user.create({
      data: {
        telegramId,
        telegramUsername: input.username,
        displayName,
        avatarUrl: input.photo_url,
        referralCode,
        referredById: referral.referredById,
        lastOnlineAt: new Date(),
      },
    });
    await prisma.notificationPreference.create({ data: { userId: user.id } });

    await createAuditLog({
      actorId: user.id,
      action: "user.register.telegram",
      entityType: "user",
      entityId: user.id,
      ipAddress: input.ipAddress,
      metadata: {
        telegramId: input.id.toString(),
        ...(referral.normalizedCode
          ? {
              referralCode: referral.normalizedCode,
              referralAttributed: referral.attributed,
              referrerId: referral.referredById ?? null,
            }
          : {}),
      },
    });
  } else {
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("Account suspended");
    }

    await releaseStuckAbuseRestrictions(user.id);

    const displayName = [input.first_name, input.last_name].filter(Boolean).join(" ") || undefined;

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramUsername: input.username,
        displayName: displayName ?? user.displayName,
        avatarUrl: input.photo_url ?? user.avatarUrl,
        lastLoginAt: new Date(),
        lastLoginIp: input.ipAddress,
        lastOnlineAt: new Date(),
      },
    });
  }

  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      ipAddress: input.ipAddress ?? "0.0.0.0",
      userAgent: input.userAgent,
      success: true,
      method: "telegram",
    },
  });

  const { token } = await createSessionForUser(
    user.id,
    user.role,
    input.ipAddress,
    input.userAgent,
  );

  await createAuditLog({
    actorId: user.id,
    action: isNewUser ? "user.login.telegram" : "user.login",
    entityType: "user",
    entityId: user.id,
    ipAddress: input.ipAddress,
    metadata: { method: "telegram", isNewUser },
  });

  return { user, token, isNewUser };
}

export async function logout(sessionId: string, userId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { isRevoked: true },
  });
}

export async function getActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
  });
}

export async function revokeSession(sessionId: string, userId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { isRevoked: true },
  });
}

export async function getLoginHistory(userId: string, limit = 20) {
  return prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export { touchUserPresence } from "./presence";
