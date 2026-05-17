import { prisma } from "@dior/database";
import { projectToReadModels } from "./projector";
import type { StoredDomainEvent } from "./store";

export async function rebuildReadModels(): Promise<{ count: number }> {
  await prisma.activityReadModel.deleteMany({});
  await prisma.serviceTimelineReadModel.deleteMany({});

  const events = await prisma.domainEvent.findMany({
    orderBy: { createdAt: "asc" },
  });

  for (const row of events) {
    const event: StoredDomainEvent = {
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
    await projectToReadModels(event);
  }

  return { count: events.length };
}
