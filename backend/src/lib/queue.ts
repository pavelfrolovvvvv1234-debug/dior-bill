import type { QueueJob, QueueJobType } from "@dior/shared";
import { getRedis, isRedisSkipped } from "./redis";
import {
  dispatchInlineJob,
  shouldRunInlineJobInBackground,
} from "./inline-jobs";
import { reportOperationalIssue } from "./operational-alerts";

const QUEUE_PREFIX = "dior:queue:";
const PROCESSING_PREFIX = "dior:processing:";

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
    await redis.lpush(`${QUEUE_PREFIX}${type}`, JSON.stringify(job));
    await redis.lpush(`${QUEUE_PREFIX}all`, JSON.stringify(job));
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
  const queueKeys = types?.length
    ? types.map((t) => `${QUEUE_PREFIX}${t}`)
    : [`${QUEUE_PREFIX}all`];

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
    await redis.lpush(`${QUEUE_PREFIX}${job.type}`, JSON.stringify(retry));
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
