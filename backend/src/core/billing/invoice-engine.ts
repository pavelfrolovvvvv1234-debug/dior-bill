import { prisma, type InvoiceStatus, type Prisma } from "@dior/database";
import { NotFoundError, ValidationError, generateInvoiceNumber, DOMAIN_EVENTS } from "@dior/shared";
import { appendDomainEvent } from "../events/store";
import { processReferralCommission } from "../../referrals";
import { emitPaymentConfirmed } from "./engine";

/**
 * BillingEngine — sole mutator for Invoice entities.
 */
export async function createInvoiceInEngine(params: {
  userId: string;
  items: Array<{
    description: string;
    unitPrice: number;
    quantity?: number;
    serviceId?: string;
  }>;
  dueInDays?: number;
  notes?: string;
  idempotencyKey?: string;
}) {
  const subtotal = params.items.reduce(
    (sum, i) => sum + i.unitPrice * (i.quantity ?? 1),
    0,
  );
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + (params.dueInDays ?? 7));

  let number = generateInvoiceNumber();
  while (await prisma.invoice.findUnique({ where: { number } })) {
    number = generateInvoiceNumber();
  }

  const invoice = await prisma.invoice.create({
    data: {
      userId: params.userId,
      number,
      status: "PENDING",
      subtotal,
      tax: 0,
      total: subtotal,
      dueAt,
      notes: params.notes,
      items: {
        create: params.items.map((i) => ({
          description: i.description,
          unitPrice: i.unitPrice,
          quantity: i.quantity ?? 1,
          total: i.unitPrice * (i.quantity ?? 1),
          serviceId: i.serviceId,
        })),
      },
    },
    include: { items: true },
  });

  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.INVOICE_CREATED,
    aggregateType: "invoice",
    aggregateId: invoice.id,
    userId: params.userId,
    payload: { number: invoice.number, total: Number(invoice.total) },
    idempotencyKey: params.idempotencyKey ?? `invoice.created:${invoice.id}`,
  });

  return invoice;
}

export async function payInvoiceFromBalanceInEngine(
  invoiceId: string,
  userId: string,
  amount?: number,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { items: true },
  });
  if (!invoice) throw new NotFoundError("Invoice not found");
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    throw new ValidationError("Invoice cannot be paid");
  }

  const remaining = Number(invoice.total) - Number(invoice.amountPaid);
  const payAmount = amount ?? remaining;

  if (remaining <= 0 && Number(invoice.total) === 0) {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: 0,
          status: "PAID",
          paidAt: new Date(),
        },
        include: { items: true },
      });
      return { updated, isPaid: true, payAmount: 0 };
    });
    if (result.isPaid) {
      await emitPaymentConfirmed({
        userId,
        invoiceId,
        amount: 0,
        idempotencyKey: `invoice.paid:${invoiceId}`,
      });
    }
    return result;
  }

  if (payAmount <= 0 || payAmount > remaining) {
    throw new ValidationError("Invalid payment amount");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || Number(user.balance) < payAmount) {
    throw new ValidationError("Insufficient balance");
  }

  const result = await prisma.$transaction(async (tx) => {
    const newBalance = Number(user.balance) - payAmount;
    const newAmountPaid = Number(invoice.amountPaid) + payAmount;
    const isPaid = newAmountPaid >= Number(invoice.total);

    await tx.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });

    await tx.transaction.create({
      data: {
        userId,
        invoiceId,
        type: "DEBIT",
        amount: payAmount,
        balanceAfter: newBalance,
        description: `Payment for invoice ${invoice.number}`,
      },
    });

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: isPaid ? "PAID" : "PARTIAL",
        paidAt: isPaid ? new Date() : undefined,
      },
      include: { items: true },
    });

    if (isPaid) {
      await processReferralCommission(userId, payAmount, invoiceId, tx);
    }

    return { updated, isPaid, payAmount };
  });

  if (result.isPaid) {
    await emitPaymentConfirmed({
      userId,
      invoiceId,
      amount: result.payAmount,
      idempotencyKey: `invoice:${invoiceId}:paid`,
    });
  }

  return result.updated;
}

export async function markInvoicesOverdueInEngine() {
  const overdue = await prisma.invoice.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueAt: { lt: new Date() },
    },
  });

  for (const invoice of overdue) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "OVERDUE" },
    });
  }

  return overdue;
}

export async function getUserInvoicesFromEngine(
  userId: string,
  status?: InvoiceStatus,
  page = 1,
  pageSize = 20,
) {
  const where: Prisma.InvoiceWhereInput = {
    userId,
    ...(status && { status }),
  };
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
