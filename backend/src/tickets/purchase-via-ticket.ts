import type { TicketPriority } from "@dior/database";
import { ValidationError } from "@dior/shared";
import { createInvoice, payInvoiceFromBalance } from "../billing";
import { createTicketRecord } from "./create-ticket";

export type TicketPurchaseProductLine =
  | "bulletproof-dedicated"
  | "dedicated"
  | "turbovds";

export async function purchaseViaSupportTicket(params: {
  userId: string;
  amount: number;
  productLine: TicketPurchaseProductLine;
  subject: string;
  body: string;
  invoiceDescription: string;
  priority?: TicketPriority;
  metadata?: Record<string, unknown>;
}) {
  if (params.amount <= 0) {
    throw new ValidationError("Invalid order amount");
  }

  const invoice = await createInvoice({
    userId: params.userId,
    items: [
      {
        description: params.invoiceDescription,
        unitPrice: params.amount,
        quantity: 1,
      },
    ],
    notes: `Ticket provisioning · ${params.productLine}`,
    idempotencyKey: `ticket-order:${params.productLine}:${params.userId}:${Date.now()}`,
  });

  await payInvoiceFromBalance(invoice.id, params.userId);

  const ticket = await createTicketRecord({
    userId: params.userId,
    subject: params.subject,
    body: params.body,
    priority: params.priority ?? "HIGH",
    attachments: params.metadata ? [params.metadata] : undefined,
  });

  return { ticket, invoice };
}
