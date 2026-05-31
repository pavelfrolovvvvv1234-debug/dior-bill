import { prisma } from "@dior/database";
import type { Prisma, UserRole, UserStatus } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { requirePermission } from "../rbac";

export type AdminUserDetail = {
  user: {
    id: string;
    email: string | null;
    telegramUsername: string | null;
    role: UserRole;
    status: UserStatus;
    balance: number;
    createdAt: string;
    serviceCount: number;
    referralCount: number;
    ticketCount: number;
  };
  totalSpent: number;
  referralEarnings: number;
  services: Array<{
    id: string;
    type: string;
    status: string;
    label: string;
    monthlyPrice: number;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorEmail: string | null;
  }>;
};

function toMoney(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function listAdminUsers(
  actorId: string,
  options: {
    q?: string;
    status?: UserStatus;
    role?: UserRole;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await requirePermission(actorId, "users.read");

  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 20, 100);
  const q = options.q?.trim() ?? "";

  const where = {
    ...(options.status && { status: options.status }),
    ...(options.role && { role: options.role }),
    ...(q && {
      OR: [
        { email: { contains: q } },
        { displayName: { contains: q } },
        { referralCode: { contains: q } },
        { telegramUsername: { contains: q } },
        ...(q.length > 8 ? [{ id: q }] : []),
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        telegramId: true,
        telegramUsername: true,
        displayName: true,
        role: true,
        status: true,
        balance: true,
        credits: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        _count: { select: { services: true, referrals: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = items.map((u) => u.id);
  const spent = userIds.length
    ? await prisma.transaction.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, type: "PAYMENT" },
        _sum: { amount: true },
      })
    : [];
  const referralEarned = userIds.length
    ? await prisma.referralEarning.groupBy({
        by: ["earnerId"],
        where: { earnerId: { in: userIds } },
        _sum: { amount: true },
      })
    : [];

  const spentMap = Object.fromEntries(spent.map((s) => [s.userId, Number(s._sum.amount ?? 0)]));
  const refMap = Object.fromEntries(
    referralEarned.map((r) => [r.earnerId, Number(r._sum.amount ?? 0)]),
  );

  return {
    items: items.map((u) => ({
      ...u,
      telegramId: u.telegramId?.toString() ?? null,
      activeServices: u._count.services,
      referralCount: u._count.referrals,
      totalSpent: spentMap[u.id] ?? 0,
      referralEarnings: refMap[u.id] ?? 0,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getAdminUserDetail(
  actorId: string,
  userId: string,
): Promise<AdminUserDetail> {
  await requirePermission(actorId, "users.read");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      telegramUsername: true,
      role: true,
      status: true,
      balance: true,
      createdAt: true,
      _count: { select: { services: true, referrals: true, tickets: true } },
    },
  });
  if (!user) throw new NotFoundError("User not found");

  const [totalSpent, referralEarnings, recentAudit, services] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: "PAYMENT" },
      _sum: { amount: true },
    }),
    prisma.referralEarning.aggregate({
      where: { earnerId: userId },
      _sum: { amount: true },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "user", entityId: userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { actor: { select: { email: true } } },
    }),
    prisma.service.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, status: true, label: true, monthlyPrice: true },
    }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      telegramUsername: user.telegramUsername,
      role: user.role,
      status: user.status,
      balance: toMoney(user.balance),
      createdAt: user.createdAt.toISOString(),
      serviceCount: user._count.services,
      referralCount: user._count.referrals,
      ticketCount: user._count.tickets,
    },
    totalSpent: toMoney(totalSpent._sum.amount),
    referralEarnings: toMoney(referralEarnings._sum.amount),
    recentAudit: recentAudit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      actorEmail: entry.actor?.email ?? null,
    })),
    services: services.map((service) => ({
      id: service.id,
      type: service.type,
      status: service.status,
      label: service.label,
      monthlyPrice: toMoney(service.monthlyPrice),
    })),
  };
}

export async function adjustUserBalance(
  actorId: string,
  userId: string,
  params: { amount: number; type: "credit" | "debit"; reason: string },
  ipAddress?: string,
) {
  await requirePermission(actorId, "users.write");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError();

  const delta = params.type === "credit" ? params.amount : -params.amount;
  const before = Number(user.balance);
  const after = before + delta;
  if (after < 0) throw new Error("Balance cannot be negative");

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: after },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: params.type === "credit" ? "CREDIT" : "ADJUSTMENT",
        amount: Math.abs(params.amount),
        balanceAfter: after,
        description: `Admin adjustment: ${params.reason}`,
        metadata: { actorId, reason: params.reason },
      },
    }),
  ]);

  await createAuditLog({
    actorId,
    action: "user.balance.adjust",
    entityType: "user",
    entityId: userId,
    metadata: { before, after, delta, reason: params.reason },
    ipAddress,
  });

  return updated;
}

export async function updateAdminUserStatus(
  actorId: string,
  userId: string,
  status: UserStatus,
  reason?: string,
) {
  await requirePermission(actorId, "users.write");

  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw new NotFoundError();

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  await createAuditLog({
    actorId,
    action: `user.status.${status.toLowerCase()}`,
    entityType: "user",
    entityId: userId,
    metadata: { before: before.status, after: status, reason },
  });

  return updated;
}

export async function updateAdminUserRole(actorId: string, userId: string, role: UserRole) {
  await requirePermission(actorId, "users.write");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  await createAuditLog({
    actorId,
    action: "user.role.update",
    entityType: "user",
    entityId: userId,
    metadata: { role },
  });

  return updated;
}

export async function updateReferralPercent(
  actorId: string,
  userId: string,
  percent: number | null,
) {
  await requirePermission(actorId, "referrals.write");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { customReferralPercent: percent },
  });

  await createAuditLog({
    actorId,
    action: "referral.percent.update",
    entityType: "user",
    entityId: userId,
    metadata: { percent },
  });

  return updated;
}
