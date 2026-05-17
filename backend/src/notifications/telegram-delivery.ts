import { prisma } from "@dior/database";
import { escapeTelegramHtml, sendTelegramMessage } from "../telegram/bot";

function appUrl(path?: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function deliverTelegramNotification(notificationId: string, userId: string) {
  const [notification, user] = await Promise.all([
    prisma.notification.findUnique({ where: { id: notificationId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    }),
  ]);

  if (!notification) {
    return { ok: false as const, reason: "notification_not_found" };
  }

  if (!user?.telegramId) {
    await prisma.notificationDelivery.updateMany({
      where: { notificationId, channel: "telegram" },
      data: { status: "failed", error: "User has no linked Telegram" },
    });
    return { ok: false as const, reason: "no_telegram" };
  }

  const lines = [
    `<b>${escapeTelegramHtml(notification.title)}</b>`,
    escapeTelegramHtml(notification.body),
  ];
  if (notification.link) {
    lines.push(`<a href="${appUrl(notification.link)}">Open</a>`);
  }

  const result = await sendTelegramMessage(user.telegramId, lines.join("\n"), {
    parse_mode: "HTML",
  });

  const delivery = await prisma.notificationDelivery.findFirst({
    where: { notificationId, channel: "telegram" },
  });

  if (delivery) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: result.ok
        ? { status: "sent", sentAt: new Date(), error: null }
        : { status: "failed", error: result.reason, retryCount: delivery.retryCount + 1 },
    });
  }

  return result;
}
