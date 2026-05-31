import { prisma } from "@dior/database";
import { NotFoundError } from "@dior/shared";

/** Plain-text invoice document for download / print. */
export async function renderInvoiceText(invoiceId: string, userId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      items: true,
      user: { select: { email: true, displayName: true } },
    },
  });
  if (!invoice) throw new NotFoundError("Invoice not found");

  const lines = [
    "DIOR HOST — INVOICE",
    "====================",
    `Invoice: ${invoice.number}`,
    `Date: ${invoice.createdAt.toISOString().slice(0, 10)}`,
    `Due: ${invoice.dueAt?.toISOString().slice(0, 10) ?? "—"}`,
    `Status: ${invoice.status}`,
    "",
    `Bill to: ${invoice.user.displayName ?? invoice.user.email ?? userId}`,
    "",
    "Items",
    "-----",
    ...invoice.items.map(
      (item) =>
        `${item.description} | ${item.quantity} x $${Number(item.unitPrice).toFixed(2)} = $${Number(item.total).toFixed(2)}`,
    ),
    "",
    `Subtotal: $${Number(invoice.subtotal).toFixed(2)}`,
    `Tax: $${Number(invoice.tax).toFixed(2)}`,
    `Total: $${Number(invoice.total).toFixed(2)}`,
    `Paid: $${Number(invoice.amountPaid).toFixed(2)}`,
    `Balance due: $${(Number(invoice.total) - Number(invoice.amountPaid)).toFixed(2)}`,
  ];

  if (invoice.notes) {
    lines.push("", "Notes", invoice.notes);
  }

  return lines.join("\n");
}
