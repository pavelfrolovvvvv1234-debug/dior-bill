import { prisma } from "@dior/database";
import { getRedis } from "../../lib/redis";
import type { StoredDomainEvent } from "./store";

const STREAM_KEY = "dior:events:stream";

/** Poll domain_events for SSE (read-only). */
export async function getEventsSince(
  userId: string,
  since: Date,
  limit = 50,
): Promise<StoredDomainEvent[]> {
  const rows = await prisma.domainEvent.findMany({
    where: {
      createdAt: { gt: since },
      OR: [{ userId }, { userId: null }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType as StoredDomainEvent["eventType"],
    aggregateType: r.aggregateType as StoredDomainEvent["aggregateType"],
    aggregateId: r.aggregateId,
    userId: r.userId ?? undefined,
    payload: r.payload as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}

export async function readRedisStreamBatch(
  lastId = "0",
  count = 10,
): Promise<Array<{ id: string; event: StoredDomainEvent }>> {
  try {
    const redis = getRedis();
    const result = await redis.xread("COUNT", count, "STREAMS", STREAM_KEY, lastId);
    if (!result?.length) return [];

    const [, messages] = result[0] as [string, Array<[string, string[]]>];
    return messages.map(([id, fields]) => {
      const payloadIdx = fields.indexOf("payload");
      const parsed = JSON.parse(fields[payloadIdx + 1] ?? "{}") as StoredDomainEvent;
      return { id, event: parsed };
    });
  } catch {
    return [];
  }
}
