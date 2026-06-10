import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";
import { cachedWith, type CacheStore } from "@/lib/redis/cache";
import {
  checkRateLimitWith,
  type RateLimitResult,
  type RateLimitStore,
} from "@/lib/redis/rateLimit";

/**
 * Cliente de Upstash Redis (REST). Server-only: usa secretos de servidor.
 * El cliente de Upstash cumple `CacheStore` estructuralmente.
 */
export const redis = new Redis({
  url: serverEnv.UPSTASH_REDIS_REST_URL,
  token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Cache-aside sobre la instancia real de Redis.
 * @example const matches = await cached("fixtures:2026-06-12", 3600, fetchFixtures)
 */
export function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  return cachedWith(redis as unknown as CacheStore, key, ttlSeconds, fetcher);
}

/**
 * Borra una o más claves (invalidación). No-op si no se pasan claves (Upstash
 * `DEL` exige al menos una). Devuelve cuántas se borraron.
 * Lo usa el cron de resultados para invalidar leaderboards (tarea 5.6).
 */
export function del(...keys: string[]): Promise<number> {
  if (keys.length === 0) return Promise.resolve(0);
  return redis.del(...keys);
}

/**
 * Rate limit de ventana fija sobre la instancia real de Redis (tarea 8.4).
 * @example const { allowed } = await rateLimit(`predictions:${userId}`, 20, 60)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  return checkRateLimitWith(
    redis as unknown as RateLimitStore,
    `ratelimit:${key}`,
    limit,
    windowSeconds,
  );
}
