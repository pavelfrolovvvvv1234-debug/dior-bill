import { prisma } from "@dior/database";

const PRESENCE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Update last-seen timestamps (throttled — at most once per 5 minutes). */
export async function touchUserPresence(userId: string, sessionId?: string): Promise<void> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PRESENCE_TOUCH_INTERVAL_MS);

  try {
    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastOnlineAt: null }, { lastOnlineAt: { lt: staleBefore } }],
      },
      data: { lastOnlineAt: now },
    });
  } catch {
    // Column may be missing until deploy/sql/add_last_online_at.sql is applied.
  }

  if (!sessionId) return;

  await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
      isRevoked: false,
      lastActiveAt: { lt: staleBefore },
    },
    data: { lastActiveAt: now },
  });
}
