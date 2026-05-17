import { prisma } from "@dior/database";
import { processEventById } from "./handlers";
import { rebuildReadModels } from "./rebuild-read-models";

/**
 * Deterministic event replay — rebuild projections without mutating write models.
 */
export async function replayAllEvents(options?: {
  from?: Date;
  batchSize?: number;
  dryRun?: boolean;
}): Promise<{ processed: number }> {
  const batchSize = options?.batchSize ?? 100;
  let skip = 0;
  let processed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const events = await prisma.domainEvent.findMany({
      where: options?.from ? { createdAt: { gte: options.from } } : undefined,
      orderBy: { createdAt: "asc" },
      take: batchSize,
      skip,
    });

    if (!events.length) break;

    for (const event of events) {
      if (!options?.dryRun) {
        await processEventById(event.id, "project");
      }
      processed++;
    }

    skip += events.length;
    if (events.length < batchSize) break;
  }

  return { processed };
}

export async function replayAggregate(
  aggregateType: string,
  aggregateId: string,
): Promise<{ processed: number }> {
  const events = await prisma.domainEvent.findMany({
    where: { aggregateType, aggregateId },
    orderBy: { createdAt: "asc" },
  });

  for (const event of events) {
    await processEventById(event.id, "project");
  }

  return { processed: events.length };
}

export { rebuildReadModels };
