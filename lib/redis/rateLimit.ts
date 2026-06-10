/**
 * Rate limiting con ventana fija (tarea 8.4).
 *
 * Lógica pura, sin dependencias de Upstash: recibe un `RateLimitStore`
 * inyectable (lo cumple el cliente de Upstash estructuralmente), igual que el
 * patrón cache-aside (1.9). Así se testea sin Redis real; `client.ts` lo cablea
 * con la instancia real.
 *
 * Ventana fija: `INCR key` (lo crea en 1 si no existía) y, en el primer hit del
 * período, `EXPIRE key window`. La ventana se renueva sola al expirar la clave.
 * Simple y barato (1-2 comandos por request); suficiente para frenar abuso de
 * endpoints de escritura (crear pronóstico / liga — ARCHITECTURE §8).
 */

export interface RateLimitStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  /** TTL restante en milisegundos. -1 sin expiración, -2 si la clave no existe. */
  pttl(key: string): Promise<number>;
}

export interface RateLimitResult {
  /** ¿Se permite esta request? (count <= limit). */
  allowed: boolean;
  /** Cuántas requests más se permiten en la ventana actual. */
  remaining: number;
  limit: number;
  /** Segundos hasta que la ventana se reinicia (para el header Retry-After). */
  resetSeconds: number;
}

export async function checkRateLimitWith(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const count = await store.incr(key);

  // Primer hit de la ventana: setear la expiración.
  if (count === 1) {
    await store.expire(key, windowSeconds);
  }

  let resetSeconds = windowSeconds;
  if (count > 1) {
    const ttl = await store.pttl(key);
    if (ttl > 0) {
      resetSeconds = Math.ceil(ttl / 1000);
    } else {
      // Clave sin expiración (caso de borde, p. ej. EXPIRE previo falló):
      // re-armar la ventana para que no quede contando para siempre.
      await store.expire(key, windowSeconds);
    }
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
    resetSeconds,
  };
}
