import { prisma } from "@dior/database";
import { ValidationError } from "@dior/shared";

/** Max manual support tickets a user can open per rolling 24 hours. */
export const SUPPORT_TICKETS_PER_DAY = 3;

const SUPPORT_TICKET_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function assertSupportTicketDailyLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - SUPPORT_TICKET_WINDOW_MS);
  const count = await prisma.ticket.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });

  if (count >= SUPPORT_TICKETS_PER_DAY) {
    throw new ValidationError(
      `You can open at most ${SUPPORT_TICKETS_PER_DAY} support tickets per day`,
    );
  }
}
