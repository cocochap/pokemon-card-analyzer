import { Redis } from '@upstash/redis'

const redisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

export const redis = redisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (!redis) return fn()

  try {
    const cached = await redis.get<T>(key)
    if (cached !== null && cached !== undefined) return cached
  } catch {
    // Redis unavailable — fall through to DB
  }

  const result = await fn()

  try {
    await redis.setex(key, ttlSeconds, result as any)
  } catch {
    // Ignore cache write errors
  }

  return result
}

export async function invalidateCache(...keys: string[]) {
  if (!redis) return
  try {
    if (keys.length > 0) await redis.del(...keys)
  } catch {}
}

export async function flushAllCache() {
  if (!redis) return
  try {
    await redis.flushall()
  } catch {}
}
