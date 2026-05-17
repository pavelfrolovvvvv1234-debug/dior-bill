import Redis from "ioredis";

let redis: Redis | null = null;

export function isRedisSkipped(): boolean {
  return process.env.SKIP_REDIS === "true" || process.env.SKIP_REDIS === "1";
}

export function getRedis(): Redis {
  if (isRedisSkipped()) {
    throw new Error("Redis disabled (SKIP_REDIS)");
  }
  if (!redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (isRedisSkipped()) return null;
  try {
    const data = await getRedis().get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300,
): Promise<void> {
  if (isRedisSkipped()) return;
  try {
    await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    /* dev without redis */
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (isRedisSkipped()) return;
  try {
    await getRedis().del(key);
  } catch {
    /* dev without redis */
  }
}
