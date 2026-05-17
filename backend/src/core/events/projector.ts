import { prisma } from "@dior/database";
import { DOMAIN_EVENTS } from "@dior/shared";
import type { StoredDomainEvent } from "./store";

/**
 * CQRS read-side projector. ONLY mutates read models from events.
 */
export async function projectToReadModels(event: StoredDomainEvent): Promise<void> {
  switch (event.eventType) {
    case DOMAIN_EVENTS.SERVICE_CREATED:
    case DOMAIN_EVENTS.SERVICE_PROVISIONING_STARTED:
    case DOMAIN_EVENTS.SERVICE_PROVISIONED:
    case DOMAIN_EVENTS.SERVICE_SUSPENDED:
    case DOMAIN_EVENTS.SERVICE_FAILED:
    case DOMAIN_EVENTS.SERVICE_DELETED:
      await projectServiceTimeline(event);
      if (event.userId) await projectActivity(event);
      break;

    case DOMAIN_EVENTS.PAYMENT_CONFIRMED:
    case DOMAIN_EVENTS.INVOICE_PAID:
      if (event.userId) await projectActivity(event);
      break;

    default:
      break;
  }
}

async function projectServiceTimeline(event: StoredDomainEvent): Promise<void> {
  const serviceId = event.aggregateId;
  const meta = event.payload;
  const titles: Record<string, { title: string; severity: string }> = {
    [DOMAIN_EVENTS.SERVICE_CREATED]: { title: "Service ordered", severity: "info" },
    [DOMAIN_EVENTS.SERVICE_PROVISIONING_STARTED]: {
      title: "Provisioning started",
      severity: "info",
    },
    [DOMAIN_EVENTS.SERVICE_PROVISIONED]: { title: "Deployed", severity: "success" },
    [DOMAIN_EVENTS.SERVICE_SUSPENDED]: { title: "Suspended", severity: "warning" },
    [DOMAIN_EVENTS.SERVICE_FAILED]: { title: "Provisioning failed", severity: "error" },
    [DOMAIN_EVENTS.SERVICE_DELETED]: { title: "Deleted", severity: "info" },
  };
  const t = titles[event.eventType] ?? { title: event.eventType, severity: "info" };

  await prisma.serviceTimelineReadModel.upsert({
    where: { sourceEventId: event.id },
    create: {
      serviceId,
      eventType: event.eventType,
      title: t.title,
      description: (meta.description as string) ?? undefined,
      severity: t.severity,
      sourceEventId: event.id,
      occurredAt: event.createdAt,
    },
    update: {},
  });
}

async function projectActivity(event: StoredDomainEvent): Promise<void> {
  if (!event.userId) return;

  const kind =
    event.eventType.startsWith("payment") || event.eventType.startsWith("invoice")
      ? "billing"
      : event.eventType.startsWith("service")
        ? "service"
        : "infra";

  const title =
    (event.payload.title as string) ??
    event.eventType.replace(/\./g, " ");

  await prisma.activityReadModel.upsert({
    where: { sourceEventId: event.id },
    create: {
      userId: event.userId,
      kind,
      title,
      subtitle: event.payload.subtitle as string | undefined,
      severity: (event.payload.severity as string) ?? "info",
      link: event.payload.link as string | undefined,
      sourceEventId: event.id,
      occurredAt: event.createdAt,
    },
    update: {},
  });
}
