import { prisma, type TicketStatus, type TicketPriority } from "@dior/database";
import { toJsonValue } from "../lib/json";
import { NotFoundError, ForbiddenError, ADMIN_ROLES } from "@dior/shared";
import { createNotification } from "../notifications";
import { notifyAdminsTicketReply } from "../telegram";
import { NOTIFICATION_TYPES } from "@dior/shared";
import { redactStaffAuthorForCustomer } from "../lib/staff-privacy";
import { createTicketRecord } from "./create-ticket";
import { assertSupportTicketDailyLimit } from "./limits";

export { purchaseViaSupportTicket } from "./purchase-via-ticket";
export type { TicketPurchaseProductLine } from "./purchase-via-ticket";
export { SUPPORT_TICKETS_PER_DAY } from "./limits";

export async function createTicket(
  params: Parameters<typeof createTicketRecord>[0],
) {
  await assertSupportTicketDailyLimit(params.userId);
  return createTicketRecord(params);
}

export async function getUserTickets(userId: string, status?: TicketStatus) {
  return prisma.ticket.findMany({
    where: { userId, ...(status && { status }) },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });
}

export async function getTicketById(ticketId: string, userId: string, isStaff = false) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      ...(isStaff ? {} : { userId }),
    },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      messages: {
        where: isStaff ? undefined : { internal: false },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, email: true, role: true } },
        },
      },
    },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");

  if (!isStaff) {
    return {
      ...ticket,
      messages: ticket.messages.map((message) => ({
        ...message,
        author: redactStaffAuthorForCustomer(message.author),
      })),
    };
  }

  return ticket;
}

export async function replyToTicket(params: {
  ticketId: string;
  authorId: string;
  body: string;
  internal?: boolean;
  attachments?: unknown[];
}) {
  const author = await prisma.user.findUnique({ where: { id: params.authorId } });
  const isStaff =
    author && ADMIN_ROLES.includes(author.role as (typeof ADMIN_ROLES)[number]);

  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new NotFoundError();

  if (params.internal && !isStaff) throw new ForbiddenError();

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: params.ticketId,
      authorId: params.authorId,
      body: params.body,
      internal: params.internal ?? false,
      attachments: toJsonValue(params.attachments as Record<string, unknown> | undefined),
    },
  });

  await prisma.ticket.update({
    where: { id: params.ticketId },
    data: {
      status: isStaff ? "AWAITING_CUSTOMER" : "AWAITING_STAFF",
      updatedAt: new Date(),
    },
  });

  if (!params.internal) {
    if (isStaff) {
      await createNotification({
        userId: ticket.userId,
        type: NOTIFICATION_TYPES.BILLING,
        title: "Support ticket update",
        body: "New reply from support",
        link: `/support/${params.ticketId}`,
      });
    } else {
      await notifyAdminsTicketReply({
        ticketId: params.ticketId,
        userId: params.authorId,
        subject: ticket.subject,
        body: params.body,
      }).catch((err) => console.warn("[telegram] ticket reply notify:", err));
    }
  }

  return message;
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  actorId: string,
) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      closedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : null,
    },
  });
}

export async function getCannedResponses() {
  return prisma.cannedResponse.findMany({ orderBy: { title: "asc" } });
}

export async function getAllTickets(filters: {
  status?: TicketStatus;
  priority?: TicketPriority;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const where = {
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority }),
  };
  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
