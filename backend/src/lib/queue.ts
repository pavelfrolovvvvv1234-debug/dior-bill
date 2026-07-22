import type { QueueJob, QueueJobType } from "@dior/shared";
import { getRedis, isRedisSkipped } from "./redis";
import {
  dispatchInlineJob,
  shouldRunInlineJobInBackground,
} from "./inline-jobs";
import { reportOperationalIssue } from "./operational-alerts";

const QUEUE_PREFIX = "dior:queue:";
const PROCESSING_PREFIX = "dior:processing:";
/** Single consumer list — worker BRPOPs this key only. */
const ALL_QUEUE_KEY = `${QUEUE_PREFIX}all`;

function scheduleInlineJob(type: QueueJobType, payload: Record<string, unknown>) {
  const run = dispatchInlineJob(type, payload).catch((err) => {
    console.error(`[inline-job] ${type} failed:`, err);
  });
  if (shouldRunInlineJobInBackground(type)) {
    void run;
    return;
  }
  return run;
}

function isRedisQueueError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("readonly") ||
    msg.includes("redis disabled") ||
    msg.includes("econnrefused") ||
    msg.includes("connect")
  );
}

export async function enqueueJob<T extends Record<string, unknown>>(
  type: QueueJobType,
  payload: T,
): Promise<string> {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  if (isRedisSkipped()) {
    const pending = scheduleInlineJob(type, payload as Record<string, unknown>);
    if (pending) await pending;
    return id;
  }
  const redis = getRedis();
  const job: QueueJob<T> = {
    id,
    type,
    payload,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  try {
    // Push once to the queue the worker actually consumes.
    await redis.lpush(ALL_QUEUE_KEY, JSON.stringify(job));
  } catch (err) {
    console.warn(`[queue] Redis enqueue failed for ${type}, running inline`, err);
    const pending = scheduleInlineJob(type, payload as Record<string, unknown>);
    if (pending) await pending;
  }
  return id;
}

export async function dequeueJob(
  types?: QueueJobType[],
): Promise<QueueJob | null> {
  const redis = getRedis();
  // Prefer the unified all-queue. Typed keys are legacy leftovers — drain them if present.
  const queueKeys = types?.length
    ? types.map((t) => `${QUEUE_PREFIX}${t}`)
    : [ALL_QUEUE_KEY];

  const result = await redis.brpop(...queueKeys, 5);
  if (!result) return null;

  const [, raw] = result;
  const job = JSON.parse(raw) as QueueJob;
  await redis.setex(`${PROCESSING_PREFIX}${job.id}`, 3600, raw);
  return job;
}

export async function completeJob(jobId: string): Promise<void> {
  await getRedis().del(`${PROCESSING_PREFIX}${jobId}`);
}

export async function failJob(job: QueueJob, error: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${PROCESSING_PREFIX}${job.id}`);
  if (job.attempts < 3) {
    const retry: QueueJob = {
      ...job,
      attempts: job.attempts + 1,
    };
    // Must requeue to the same list the worker reads.
    await redis.lpush(ALL_QUEUE_KEY, JSON.stringify(retry));
  } else {
    await redis.lpush("dior:queue:dead", JSON.stringify({ ...job, error }));
    const payload = job.payload as Record<string, unknown>;
    await reportOperationalIssue({
      category: "queue.dead",
      message: `Job ${job.type} moved to dead letter queue`,
      severity: "critical",
      details: {
        jobType: job.type,
        jobId: job.id,
        error: error.slice(0, 200),
        serviceId: String(payload.serviceId ?? ""),
      },
      serviceId: payload.serviceId as string | undefined,
      dedupeKey: `dead:${job.id}`,
    });
  }
}

/** Move leftover jobs from legacy typed lists into dior:queue:all (one-time drain). */
export async function drainLegacyTypedQueues(
  types: QueueJobType[],
): Promise<number> {
  if (isRedisSkipped()) return 0;
  const redis = getRedis();
  let moved = 0;
  for (const type of types) {
    const key = `${QUEUE_PREFIX}${type}`;
    for (;;) {
      const raw = await redis.rpop(key);
      if (!raw) break;
      await redis.lpush(ALL_QUEUE_KEY, raw);
      moved += 1;
    }
  }
  if (moved > 0) {
    console.log(`[queue] drained ${moved} legacy typed-queue job(s) into ${ALL_QUEUE_KEY}`);
  }
  return moved;
}
