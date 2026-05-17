import { prisma } from "@dior/database";
import { toJsonValue } from "../lib/json";
import { NOTIFICATION_TYPES } from "@dior/shared";
import { enqueueJob } from "../lib/queue";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
  channels?: ("in_app" | "telegram" | "email")[];
}) {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: params.userId },
  });

  const inQuietHours = isQuietHours(prefs?.quietHoursStart, prefs?.quietHoursEnd);
  const channels = params.channels ?? ["in_app", "telegram"];

  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      metadata: toJsonValue(params.metadata),
    },
  });

  const deliveries: Array<{ channel: string; status: string }> = [];

  if (channels.includes("in_app") && prefs?.inAppEnabled !== false) {
    deliveries.push({ channel: "in_app", status: "sent" });
    await prisma.notificationDelivery.create({
      data: { notificationId: notification.id, channel: "in_app", status: "sent", sentAt: new Date() },
    });
  }

  if (
    channels.includes("telegram") &&
    prefs?.telegramEnabled !== false &&
    !inQuietHours
  ) {
    await prisma.notificationDelivery.create({
      data: { notificationId: notification.id, channel: "telegram", status: "pending" },
    });
    await enqueueJob("notification.send", {
      notificationId: notification.id,
      channel: "telegram",
      userId: params.userId,
    });
  }

  if (channels.includes("email") && prefs?.emailEnabled !== false && !inQuietHours) {
    await prisma.notificationDelivery.create({
      data: { notificationId: notification.id, channel: "email", status: "pending" },
    });
    await enqueueJob("notification.send", {
      notificationId: notification.id,
      channel: "email",
      userId: params.userId,
    });
  }

  return notification;
}

function isQuietHours(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin <= endMin) return current >= startMin && current <= endMin;
  return current >= startMin || current <= endMin;
}

export async function getUserNotifications(
  userId: string,
  unreadOnly = false,
  page = 1,
  pageSize = 20,
) {
  const where = { userId, ...(unreadOnly && { read: false }) };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { items, total, unreadCount, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true, readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

export async function updateNotificationPreferences(
  userId: string,
  data: {
    emailEnabled?: boolean;
    telegramEnabled?: boolean;
    inAppEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    categories?: Record<string, boolean>;
  },
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data, categories: toJsonValue(data.categories as Record<string, unknown> | undefined) },
    update: { ...data, categories: toJsonValue(data.categories as Record<string, unknown> | undefined) },
  });
}

export async function notifyInfrastructureUpdate(
  userIds: string[],
  title: string,
  body: string,
  link?: string,
) {
  for (const userId of userIds) {
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.INFRASTRUCTURE,
      title,
      body,
      link,
    });
  }
}

export async function retryFailedDeliveries() {
  const failed = await prisma.notificationDelivery.findMany({
    where: { status: "failed", retryCount: { lt: 3 } },
    include: { notification: true },
    take: 50,
  });
  for (const d of failed) {
    await enqueueJob("notification.send", {
      notificationId: d.notificationId,
      channel: d.channel,
      userId: d.notification.userId,
    });
  }
  return failed.length;
}
