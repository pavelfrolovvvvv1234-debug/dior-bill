import { prisma } from "@dior/database";
import { NOTIFICATION_TYPES } from "@dior/shared";
import { createNotification } from "../notifications";

/** Notify customer when an invoice becomes overdue. */
export async function handleInvoiceOverdue(payload: {
  invoiceId: string;
  userId: string;
}) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: payload.invoiceId, userId: payload.userId },
  });
  if (!invoice || invoice.status !== "OVERDUE") return;

  await createNotification({
    userId: payload.userId,
    type: NOTIFICATION_TYPES.BILLING,
    title: "Invoice overdue",
    body: `Invoice ${invoice.number} ($${Number(invoice.total).toFixed(2)}) is past due. Pay from your balance to avoid service interruption.`,
    link: `/billing/invoices/${invoice.id}`,
    channels: ["in_app", "telegram"],
  });
}
