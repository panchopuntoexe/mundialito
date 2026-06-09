/**
 * Patrón cache-aside (tarea 1.9).
 *
 * Lógica pura, sin dependencias de entorno ni de Upstash: recibe un `CacheStore`
 * inyectable (lo cumple el cliente de Upstash de forma estructural). Así se
 * testea sin Redis real. `client.ts` lo cablea con la instancia real.
 */

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
}

/**
 * Devuelve el valor cacheado en `key`; si no existe (miss), ejecuta `fetcher`,
 * lo guarda con TTL `ttlSeconds` y lo devuelve.
 */
export async function cachedWith<T>(
  store: CacheStore,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = await store.get<T>(key);
  if (hit !== null && hit !== undefined) {
    return hit;
  }
  const value = await fetcher();
  await store.set(key, value, { ex: ttlSeconds });
  return value;
}
