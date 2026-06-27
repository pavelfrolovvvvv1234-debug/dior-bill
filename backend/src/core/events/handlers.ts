import { DOMAIN_EVENTS } from "@dior/shared";
import type { StoredDomainEvent } from "./store";
import { withIdempotency } from "./idempotency";
import { projectToReadModels } from "./projector";
import { transitionServiceLifecycle, startProvisioning } from "../provisioning/engine";
import { parseInvoiceBillingAction } from "../../billing/invoice-actions";
import { resolveInvoiceBillingSideEffects } from "../../billing/service-renewal";

const PROVISION_STATUSES = new Set(["PENDING", "FAILED", "ROLLBACK"]);

/**
 * Stateless event consumers. Side effects only here — never in UI/API directly.
 */
export async function dispatchDomainEvent(event: StoredDomainEvent): Promise<void> {
  await withIdempotency("event_handler", event.id, async () => {
    await projectToReadModels(event);

    switch (event.eventType) {
      case DOMAIN_EVENTS.INVOICE_PAID:
        await handleInvoicePaid(event);
        break;
      case DOMAIN_EVENTS.PAYMENT_CONFIRMED:
        await handlePaymentConfirmed(event);
        break;

      default:
        break;
    }
  });
}

async function handleInvoicePaid(event: StoredDomainEvent): Promise<void> {
  const { prisma } = await import("@dior/database");
  const invoiceId = event.payload.invoiceId as string | undefined;
  if (!invoiceId) return;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (invoice && parseInvoiceBillingAction(invoice.notes)) {
    await resolveInvoiceBillingSideEffects(invoiceId, event.id);
  }
}

async function handlePaymentConfirmed(event: StoredDomainEvent): Promise<void> {
  const { prisma } = await import("@dior/database");

  const invoiceId = event.payload.invoiceId as string | undefined;
  let serviceIds = event.payload.serviceIds as string[] | undefined;

  if (!serviceIds?.length && invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (invoice && parseInvoiceBillingAction(invoice.notes)) {
      return;
    }

    const items = await prisma.invoiceItem.findMany({
      where: { invoiceId, serviceId: { not: null } },
      select: { serviceId: true },
    });
    serviceIds = items.map((i) => i.serviceId!).filter(Boolean);
  }

  for (const serviceId of serviceIds ?? []) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) continue;

    if (service.type === "VPS" && PROVISION_STATUSES.has(service.status)) {
      await startProvisioning({
        serviceId,
        idempotencyKey: `provision:${serviceId}:${event.id}`,
        correlationId: event.correlationId,
      });
    } else if (service.status === "PENDING") {
      await transitionServiceLifecycle({
        serviceId,
        to: "ACTIVE",
        idempotencyKey: `activate:${serviceId}:${event.id}`,
        correlationId: event.correlationId,
      });
    }
  }
}

export async function processEventById(
  eventId: string,
  mode: "dispatch" | "project" = "dispatch",
): Promise<void> {
  const { prisma } = await import("@dior/database");
  const row = await prisma.domainEvent.findUnique({ where: { id: eventId } });
  if (!row) return;

  const event = {
    id: row.id,
    eventType: row.eventType as StoredDomainEvent["eventType"],
    aggregateType: row.aggregateType as StoredDomainEvent["aggregateType"],
    aggregateId: row.aggregateId,
    userId: row.userId ?? undefined,
    payload: row.payload as Record<string, unknown>,
    idempotencyKey: row.idempotencyKey ?? undefined,
    correlationId: row.correlationId ?? undefined,
    causationId: row.causationId ?? undefined,
    createdAt: row.createdAt,
  };

  if (mode === "project") {
    await projectToReadModels(event);
    return;
  }

  await dispatchDomainEvent(event);
}
