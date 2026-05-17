import { prisma } from "@dior/database";

export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const entry = await prisma.rateLimitEntry.findUnique({ where: { key } });

  if (!entry || entry.expiresAt < now) {
    await prisma.rateLimitEntry.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: 1, expiresAt },
    });
    return { allowed: true, remaining: max - 1 };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  await prisma.rateLimitEntry.update({
    where: { key },
    data: { count: entry.count + 1 },
  });

  return { allowed: true, remaining: max - entry.count - 1 };
}
