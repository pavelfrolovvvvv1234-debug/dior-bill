import { prisma } from "@dior/database";
import { DOMAIN_EVENTS } from "@dior/shared";
import { NotFoundError, ValidationError } from "@dior/shared";
import { appendDomainEvent } from "../events/store";
import { withIdempotency } from "../events/idempotency";

const GRACE_PERIOD_DAYS = 3;

/**
 * BillingEngine — SOLE owner of Invoice/Payment state.
 * Service activation ONLY via payment.confirmed / invoice.paid events.
 */
export async function emitPaymentConfirmed(params: {
  userId: string;
  invoiceId?: string;
  topUpId?: string;
  amount: number;
  idempotencyKey: string;
  correlationId?: string;
  /** Crypto: pending confirmations */
  pendingConfirmation?: boolean;
}): Promise<void> {
  if (params.pendingConfirmation) {
    return;
  }

  await withIdempotency("billing:payment_confirmed", params.idempotencyKey, async () => {
    const serviceIds: string[] = [];

    if (params.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: params.invoiceId },
        include: { items: true },
      });
      if (!invoice) throw new NotFoundError("Invoice not found");

      for (const item of invoice.items) {
        if (item.serviceId) serviceIds.push(item.serviceId);
      }

      await appendDomainEvent({
        eventType: DOMAIN_EVENTS.INVOICE_PAID,
        aggregateType: "invoice",
        aggregateId: params.invoiceId,
        userId: params.userId,
        payload: {
          invoiceId: params.invoiceId,
          amount: params.amount,
          serviceIds,
        },
        idempotencyKey: `invoice.paid:${params.idempotencyKey}`,
        correlationId: params.correlationId,
      });
    }

    await appendDomainEvent({
      eventType: DOMAIN_EVENTS.PAYMENT_CONFIRMED,
      aggregateType: "payment",
      aggregateId: params.topUpId ?? params.invoiceId ?? params.idempotencyKey,
      userId: params.userId,
      payload: {
        invoiceId: params.invoiceId,
        topUpId: params.topUpId,
        amount: params.amount,
        serviceIds,
      },
      idempotencyKey: `payment.confirmed:${params.idempotencyKey}`,
      correlationId: params.correlationId,
    });
  });
}

export async function emitPaymentFailed(params: {
  userId: string;
  aggregateId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<void> {
  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.PAYMENT_FAILED,
    aggregateType: "payment",
    aggregateId: params.aggregateId,
    userId: params.userId,
    payload: { reason: params.reason },
    idempotencyKey: `payment.failed:${params.idempotencyKey}`,
  });
}

/** Billing-only grace marker — does not mutate service (provisioning-owned). */
export async function emitBillingGrace(params: {
  serviceId: string;
  userId: string;
  idempotencyKey: string;
}): Promise<void> {
  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + GRACE_PERIOD_DAYS);

  await appendDomainEvent({
    eventType: DOMAIN_EVENTS.BILLING_GRACE_PERIOD,
    aggregateType: "service",
    aggregateId: params.serviceId,
    userId: params.userId,
    payload: {
      graceUntil: graceUntil.toISOString(),
      billingGrace: true,
      note: "Payment delayed — grace period active, no suspension yet",
    },
    idempotencyKey: `billing.grace:${params.idempotencyKey}`,
  });
}

export async function reconcileBillingServices(): Promise<{
  checked: number;
  fixed: number;
  findings: string[];
}> {
  const findings: string[] = [];
  let fixed = 0;

  const pendingServices = await prisma.service.findMany({
    where: { status: "PENDING" },
    include: { invoiceItems: { include: { invoice: true } } },
  });

  for (const svc of pendingServices) {
    const paidInvoice = svc.invoiceItems.find((i) => i.invoice.status === "PAID");
    if (paidInvoice) {
      findings.push(`Service ${svc.id} pending but invoice ${paidInvoice.invoiceId} paid`);
      await emitPaymentConfirmed({
        userId: svc.userId,
        invoiceId: paidInvoice.invoiceId,
        amount: Number(paidInvoice.invoice.total),
        idempotencyKey: `reconcile:${svc.id}:${paidInvoice.invoiceId}`,
      });
      fixed++;
    }
  }

  const activeNoPayment = await prisma.service.findMany({
    where: { status: "ACTIVE" },
    take: 100,
  });

  for (const svc of activeNoPayment) {
    const unpaid = await prisma.invoiceItem.findFirst({
      where: {
        serviceId: svc.id,
        invoice: { status: { in: ["OVERDUE", "PENDING"] } },
      },
    });
    if (unpaid) {
      findings.push(`Active service ${svc.id} has unpaid invoice — grace check`);
    }
  }

  return { checked: pendingServices.length + activeNoPayment.length, fixed, findings };
}
