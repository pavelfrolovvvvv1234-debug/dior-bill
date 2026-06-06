import { prisma, type TicketPriority } from "@dior/database";
import { toJsonValue } from "../lib/json";
import { createNotification } from "../notifications";
import { notifyAdminsNewTicket, resolveAdminNotifyUserIds } from "../telegram";

export async function createTicketRecord(params: {
  userId: string;
  subject: string;
  body: string;
  priority?: TicketPriority;
  attachments?: unknown[];
}) {
  const ticket = await prisma.ticket.create({
    data: {
      userId: params.userId,
      subject: params.subject,
      priority: params.priority ?? "NORMAL",
      messages: {
        create: {
          authorId: params.userId,
          body: params.body,
          attachments: toJsonValue(params.attachments as Record<string, unknown> | undefined),
        },
      },
    },
    include: { messages: true },
  });

  const firstMessage = ticket.messages[0]?.body ?? params.body;
  await notifyAdminsNewTicket({
    ticketId: ticket.id,
    userId: params.userId,
    subject: params.subject,
    body: firstMessage,
  }).catch((err) => console.warn("[telegram] new ticket notify:", err));

  const adminIds = await resolveAdminNotifyUserIds();
  for (const adminId of adminIds) {
    await createNotification({
      userId: adminId,
      type: "support",
      title: "New support ticket",
      body: params.subject,
      link: `/control/support/${ticket.id}`,
      channels: ["in_app"],
    }).catch((err) => console.warn("[ticket] admin in-app notify:", err));
  }

  return ticket;
}
