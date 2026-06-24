import type { TicketPriority, TicketStatus } from "@dior/database";
import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { getAllTickets, getTicketById, replyToTicket, updateTicketStatus } from "../../tickets";
import { createAuditLog } from "../../audit";
import { requirePermission } from "../rbac";
import { getTicketCustomerStats } from "./customer-stats";

export async function listAdminTickets(
  actorId: string,
  filters: {
    status?: TicketStatus;
    priority?: TicketPriority;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await requirePermission(actorId, "support.read");
  return getAllTickets(filters);
}

export async function getAdminTicket(actorId: string, ticketId: string) {
  await requirePermission(actorId, "support.read");
  const ticket = await getTicketById(ticketId, actorId, true);
  const customerStats = await getTicketCustomerStats(ticket.user.id);
  return { ...ticket, customerStats };
}

export async function adminUpdateTicket(
  actorId: string,
  ticketId: string,
  data: { status?: TicketStatus; assignedTo?: string | null },
) {
  await requirePermission(actorId, "support.write");

  const updates: Record<string, unknown> = {};
  if (data.assignedTo !== undefined) updates.assignedTo = data.assignedTo;

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: updates,
  });

  if (data.status) {
    await updateTicketStatus(ticketId, data.status, actorId);
  }

  await createAuditLog({
    actorId,
    action: "ticket.update",
    entityType: "ticket",
    entityId: ticketId,
    metadata: data,
  });

  return ticket;
}

export async function adminReplyToTicket(
  actorId: string,
  ticketId: string,
  body: string,
  options: { internal?: boolean } = {},
) {
  await requirePermission(actorId, "support.write");
  const message = await replyToTicket({
    ticketId,
    authorId: actorId,
    body,
    internal: options.internal,
  });

  await createAuditLog({
    actorId,
    action: options.internal ? "ticket.reply.internal" : "ticket.reply",
    entityType: "ticket",
    entityId: ticketId,
  });

  return message;
}

export async function deleteAdminTicket(actorId: string, ticketId: string) {
  await requirePermission(actorId, "support.write");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, subject: true, userId: true, user: { select: { email: true } } },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");

  await prisma.ticket.delete({ where: { id: ticketId } });

  await createAuditLog({
    actorId,
    action: "ticket.delete",
    entityType: "ticket",
    entityId: ticketId,
    metadata: { subject: ticket.subject, userId: ticket.userId, userEmail: ticket.user.email },
  });
}
