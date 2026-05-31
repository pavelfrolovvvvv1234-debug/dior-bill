"use server";

import { getUserNotifications, markNotificationRead, markAllRead } from "@dior/backend";
import { requireSession } from "@/lib/auth";

export async function getNotificationsPreviewAction() {
  const session = await requireSession();
  return getUserNotifications(session.user.id, false, 1, 8);
}

export async function getUnreadNotificationsCountAction() {
  const session = await requireSession();
  const { unreadCount } = await getUserNotifications(session.user.id, false, 1, 1);
  return unreadCount;
}

export async function markNotificationReadAction(id: string) {
  const session = await requireSession();
  await markNotificationRead(id, session.user.id);
}

export async function markAllNotificationsReadAction() {
  const session = await requireSession();
  await markAllRead(session.user.id);
}
