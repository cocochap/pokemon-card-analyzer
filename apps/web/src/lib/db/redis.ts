import { Redis } from '@upstash/redis'

// Upstash Redis — serverless, gratuit jusqu'à 10k req/jour
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached !== null) return cached

  const result = await fn()
  await redis.setex(key, ttlSeconds, result)
  return result
}
