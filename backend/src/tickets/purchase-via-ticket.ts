import type { TicketPriority } from "@dior/database";
import { prisma } from "@dior/database";
import { ValidationError } from "@dior/shared";
import {
  applyPromoToOrderTotal,
  createInvoice,
  finalizeOrderPromo,
  payInvoiceFromBalance,
  releasePromoRedemption,
} from "../billing";
import { createTicketRecord } from "./create-ticket";

export type TicketPurchaseProductLine =
  | "bulletproof-dedicated"
  | "dedicated"
  | "turbovds"
  | "standard-vps";

export async function purchaseViaSupportTicket(params: {
  userId: string;
  amount: number;
  productLine: TicketPurchaseProductLine;
  subject: string;
  body: string;
  invoiceDescription: string;
  priority?: TicketPriority;
  metadata?: Record<string, unknown>;
  promoCode?: string;
}) {
  if (params.amount <= 0) {
    throw new ValidationError("Invalid order amount");
  }

  const promo = await applyPromoToOrderTotal(params.userId, params.promoCode, params.amount);

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new ValidationError("User not found");
  if (Number(user.balance) < promo.chargeAmount) {
    throw new ValidationError("Insufficient balance");
  }

  const description =
    promo.discount > 0 && promo.promoCode
      ? `${params.invoiceDescription} (promo ${promo.promoCode}: -$${promo.discount.toFixed(2)})`
      : params.invoiceDescription;

  const invoice = await createInvoice({
    userId: params.userId,
    items: [
      {
        description,
        unitPrice: promo.chargeAmount,
        quantity: 1,
      },
    ],
    notes: `Ticket provisioning · ${params.productLine}`,
    idempotencyKey: `ticket-order:${params.productLine}:${params.userId}:${Date.now()}`,
  });

  let promoClaimed = false;
  try {
    if (promo.promoId && promo.discount > 0) {
      await finalizeOrderPromo(params.userId, promo.promoId, promo.discount);
      promoClaimed = true;
    }
    await payInvoiceFromBalance(invoice.id, params.userId);
  } catch (err) {
    if (promoClaimed && promo.promoId) {
      await releasePromoRedemption(params.userId, promo.promoId).catch(() => undefined);
    }
    throw err;
  }

  const ticket = await createTicketRecord({
    userId: params.userId,
    subject: params.subject,
    body: params.body,
    priority: params.priority ?? "HIGH",
    attachments: params.metadata ? [params.metadata] : undefined,
  });

  return { ticket, invoice };
}
