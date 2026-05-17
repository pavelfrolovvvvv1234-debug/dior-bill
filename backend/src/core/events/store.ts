import { prisma } from "@dior/database";
import type { DomainEventPayload } from "@dior/shared";
import { toJsonValue } from "../../lib/json";
import { getRedis } from "../../lib/redis";
import { enqueueJob } from "../../lib/queue";

const STREAM_KEY = "dior:events:stream";

export interface StoredDomainEvent extends DomainEventPayload {
  id: string;
  createdAt: Date;
}

/**
 * Append-only event store. Single source of truth for system history.
 * Idempotent when idempotencyKey is provided.
 */
export async function appendDomainEvent(
  input: DomainEventPayload,
): Promise<StoredDomainEvent> {
  if (input.idempotencyKey) {
    const existing = await prisma.domainEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return mapRow(existing);
    }
  }

  const record = await prisma.domainEvent.create({
    data: {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      userId: input.userId,
      payload: toJsonValue(input.payload) ?? {},
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      causationId: input.causationId,
    },
  });

  const stored = mapRow(record);
  await publishToStream(stored);
  await enqueueJob("event.process", { eventId: record.id });
  return stored;
}

function mapRow(existing: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  userId: string | null;
  payload: unknown;
  idempotencyKey: string | null;
  correlationId: string | null;
  causationId: string | null;
  createdAt: Date;
}): StoredDomainEvent {
  return {
    id: existing.id,
    eventType: existing.eventType as DomainEventPayload["eventType"],
    aggregateType: existing.aggregateType as DomainEventPayload["aggregateType"],
    aggregateId: existing.aggregateId,
    userId: existing.userId ?? undefined,
    payload: existing.payload as Record<string, unknown>,
    idempotencyKey: existing.idempotencyKey ?? undefined,
    correlationId: existing.correlationId ?? undefined,
    causationId: existing.causationId ?? undefined,
    createdAt: existing.createdAt,
  };
}

async function publishToStream(event: StoredDomainEvent): Promise<void> {
  try {
    const redis = getRedis();
    await redis.xadd(
      STREAM_KEY,
      "*",
      "id",
      event.id,
      "type",
      event.eventType,
      "aggregate",
      `${event.aggregateType}:${event.aggregateId}`,
      "payload",
      JSON.stringify(event),
    );
  } catch {
    // Redis optional during dev — DB store remains authoritative
  }
}

export async function getEventsForAggregate(
  aggregateType: string,
  aggregateId: string,
  limit = 100,
): Promise<StoredDomainEvent[]> {
  const rows = await prisma.domainEvent.findMany({
    where: { aggregateType, aggregateId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map(mapRow);
}

export async function replayAggregateState<T>(
  aggregateType: string,
  aggregateId: string,
  reducer: (state: T | null, event: StoredDomainEvent) => T,
  initial: T | null = null,
): Promise<T | null> {
  const events = await getEventsForAggregate(aggregateType, aggregateId, 10_000);
  return events.reduce((acc, e) => reducer(acc, e), initial);
}
