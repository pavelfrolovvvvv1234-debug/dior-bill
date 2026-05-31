import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../../audit";
import { createInvoiceInEngine } from "../../core/billing/invoice-engine";
import { requirePermission } from "../rbac";
import { toIso, toMoney } from "./serialize";

export async function getAdminInvoiceDetail(actorId: string, invoiceId: string) {
  await requirePermission(actorId, "billing.read");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          telegramUsername: true,
          balance: true,
        },
      },
      items: {
        include: {
          service: { select: { id: true, label: true, type: true, status: true } },
        },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!invoice) throw new NotFoundError("Invoice not found");

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    subtotal: toMoney(invoice.subtotal),
    tax: toMoney(invoice.tax),
    total: toMoney(invoice.total),
    amountPaid: toMoney(invoice.amountPaid),
    currency: invoice.currency,
    dueAt: toIso(invoice.dueAt),
    paidAt: toIso(invoice.paidAt),
    notes: invoice.notes,
    createdAt: toIso(invoice.createdAt)!,
    updatedAt: toIso(invoice.updatedAt)!,
    user: {
      id: invoice.user.id,
      email: invoice.user.email,
      displayName: invoice.user.displayName,
      telegramUsername: invoice.user.telegramUsername,
      balance: toMoney(invoice.user.balance),
    },
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice),
      total: toMoney(item.total),
      service: item.service
        ? {
            id: item.service.id,
            label: item.service.label,
            type: item.service.type,
            status: item.service.status,
          }
        : null,
    })),
    transactions: invoice.transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: toMoney(tx.amount),
      balanceAfter: toMoney(tx.balanceAfter),
      description: tx.description,
      createdAt: toIso(tx.createdAt)!,
    })),
  };
}

export async function createManualInvoice(
  actorId: string,
  userId: string,
  params: {
    description: string;
    amount: number;
    quantity?: number;
    dueInDays?: number;
    notes?: string;
    serviceId?: string;
  },
) {
  await requirePermission(actorId, "billing.write");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const invoice = await createInvoiceInEngine({
    userId,
    items: [
      {
        description: params.description,
        unitPrice: params.amount,
        quantity: params.quantity ?? 1,
        serviceId: params.serviceId,
      },
    ],
    dueInDays: params.dueInDays ?? 7,
    notes: params.notes,
    idempotencyKey: `admin:invoice:${actorId}:${Date.now()}`,
  });

  await createAuditLog({
    actorId,
    action: "invoice.create.manual",
    entityType: "invoice",
    entityId: invoice.id,
    metadata: { userId, amount: params.amount, description: params.description },
  });

  return getAdminInvoiceDetail(actorId, invoice.id);
}
