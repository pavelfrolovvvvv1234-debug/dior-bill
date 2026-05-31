import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";
import { createAuditLog } from "../audit";
import { payInvoiceFromBalanceInEngine } from "../core/billing/invoice-engine";
import { emitPaymentConfirmed } from "../core/billing/engine";

/**
 * Admin mark paid — always updates invoice row (fixes desync with emit-only path).
 */
export async function adminMarkInvoicePaid(params: {
  invoiceId: string;
  userId: string;
  actorId: string;
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.invoiceId } });
  if (!invoice) throw new NotFoundError("Invoice not found");
  if (invoice.status === "PAID") return invoice;

  const remaining = Number(invoice.total) - Number(invoice.amountPaid);
  const user = await prisma.user.findUnique({ where: { id: params.userId } });

  await createAuditLog({
    actorId: params.actorId,
    action: "admin.invoice.mark_paid",
    entityType: "invoice",
    entityId: params.invoiceId,
    metadata: { remaining, userId: params.userId },
  });

  if (remaining <= 0) {
    const updated = await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { status: "PAID", amountPaid: invoice.total, paidAt: new Date() },
    });
    await emitPaymentConfirmed({
      userId: params.userId,
      invoiceId: params.invoiceId,
      amount: 0,
      idempotencyKey: `admin:paid:${params.invoiceId}`,
    });
    return updated;
  }

  if (user && Number(user.balance) >= remaining) {
    return payInvoiceFromBalanceInEngine(params.invoiceId, params.userId, remaining);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.invoice.update({
      where: { id: params.invoiceId },
      data: {
        status: "PAID",
        amountPaid: invoice.total,
        paidAt: new Date(),
      },
    });
    return row;
  });

  await emitPaymentConfirmed({
    userId: params.userId,
    invoiceId: params.invoiceId,
    amount: remaining,
    idempotencyKey: `admin:paid:${params.invoiceId}`,
  });

  return updated;
}
