import { prisma } from "@dior/database";

export async function recordUserLogin(userId: string, ipAddress?: string): Promise<void> {
  const now = new Date();
  const base = { lastLoginAt: now, lastLoginIp: ipAddress };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { ...base, lastOnlineAt: now },
    });
  } catch {
    await prisma.user.update({
      where: { id: userId },
      data: base,
    });
  }
}
