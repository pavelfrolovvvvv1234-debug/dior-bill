import { prisma } from "@dior/database";
import { NotFoundError, ForbiddenError, ADMIN_ROLES } from "@dior/shared";
import type { DashboardStats } from "@dior/shared";
import { cacheGet, cacheSet, cacheDel } from "../lib/redis";

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { affiliateTier: true, notificationPrefs: true },
  });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function invalidateUserDashboardCache(userId: string): Promise<void> {
  await cacheDel(`dashboard:${userId}`);
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const cacheKey = `dashboard:${userId}`;
  const cached = await cacheGet<DashboardStats>(cacheKey);
  if (cached) return cached;

  const [user, activeServices, pendingInvoices, referralSum, unread] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true, balanceLocked: true, credits: true },
      }),
      prisma.service.count({
        where: { userId, status: "ACTIVE" },
      }),
      prisma.invoice.count({
        where: { userId, status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } },
      }),
      prisma.referralEarning.aggregate({
        where: { earnerId: userId },
        _sum: { amount: true },
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

  const totalBalance = Number(user?.balance ?? 0);
  const locked = Number(user?.balanceLocked ?? 0);

  const stats: DashboardStats = {
    // Dashboard UI labels this as "available balance" — match billing page.
    balance: totalBalance - locked,
    credits: Number(user?.credits ?? 0),
    activeServices,
    pendingInvoices,
    referralEarnings: Number(referralSum._sum.amount ?? 0),
    unreadNotifications: unread,
  };

  await cacheSet(cacheKey, stats, 60);
  return stats;
}

export async function updateUserProfile(
  userId: string,
  data: { displayName?: string; locale?: string; timezone?: string; theme?: string },
) {
  const user = await prisma.user.update({ where: { id: userId }, data });
  await invalidateUserDashboardCache(userId);
  return user;
}

export async function suspendUser(actorId: string, targetId: string, reason?: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor || !ADMIN_ROLES.includes(actor.role as (typeof ADMIN_ROLES)[number])) {
    throw new ForbiddenError();
  }
  return prisma.user.update({
    where: { id: targetId },
    data: { status: "SUSPENDED" },
  });
}

export async function searchUsers(query: string, page = 1, pageSize = 20) {
  const where = {
    OR: [
      { email: { contains: query } },
      { displayName: { contains: query } },
      { referralCode: { contains: query } },
      { telegramUsername: { contains: query } },
    ],
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
        displayName: true,
        role: true,
        status: true,
        balance: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
