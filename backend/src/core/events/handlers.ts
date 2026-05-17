import { DOMAIN_EVENTS } from "@dior/shared";
import type { StoredDomainEvent } from "./store";
import { withIdempotency } from "./idempotency";
import { projectToReadModels } from "./projector";
import { transitionServiceLifecycle, startProvisioning } from "../provisioning/engine";

/**
 * Stateless event consumers. Side effects only here — never in UI/API directly.
 */
export async function dispatchDomainEvent(event: StoredDomainEvent): Promise<void> {
  await withIdempotency("event_handler", event.id, async () => {
    await projectToReadModels(event);

    switch (event.eventType) {
      case DOMAIN_EVENTS.PAYMENT_CONFIRMED:
      case DOMAIN_EVENTS.INVOICE_PAID:
        await handlePaymentConfirmed(event);
        break;

      default:
        break;
    }
  });
}

async function handlePaymentConfirmed(event: StoredDomainEvent): Promise<void> {
  const { prisma } = await import("@dior/database");

  let serviceIds = event.payload.serviceIds as string[] | undefined;
  const invoiceId = event.payload.invoiceId as string | undefined;

  if (!serviceIds?.length && invoiceId) {
    const items = await prisma.invoiceItem.findMany({
      where: { invoiceId, serviceId: { not: null } },
      select: { serviceId: true },
    });
    serviceIds = items.map((i) => i.serviceId!).filter(Boolean);
  }

  for (const serviceId of serviceIds ?? []) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) continue;

    if (service.type === "VPS") {
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
