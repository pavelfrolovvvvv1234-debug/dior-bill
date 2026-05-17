import { prisma } from "@dior/database";

/**
 * CQRS READ SIDE — UI/API must use these, never write models for display logic.
 */

export async function getActivityFeedReadModel(userId: string, limit = 30) {
  return prisma.activityReadModel.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

export async function getServiceTimelineReadModel(serviceId: string, limit = 50) {
  return prisma.serviceTimelineReadModel.findMany({
    where: { serviceId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

export async function getDashboardReadModel(userId: string) {
  const [activity, services, pendingInvoices] = await Promise.all([
    getActivityFeedReadModel(userId, 10),
    prisma.service.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        status: true,
        type: true,
        vpsInstance: { select: { primaryIp: true, cpuUsage: true, ramUsage: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.invoice.count({
      where: { userId, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
    }),
  ]);

  return { activity, services, pendingInvoices };
}
