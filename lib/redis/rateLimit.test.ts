import { describe, expect, it, vi } from "vitest";
import { checkRateLimitWith, type RateLimitStore } from "@/lib/redis/rateLimit";

/** Store en memoria que cumple RateLimitStore (INCR/EXPIRE/PTTL). */
function makeStore() {
  const counts = new Map<string, number>();
  const ttlMs = new Map<string, number>();
  const store: RateLimitStore = {
    incr: async (key) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    expire: async (key, seconds) => {
      ttlMs.set(key, seconds * 1000);
      return 1;
    },
    pttl: async (key) => {
      if (!counts.has(key)) return -2;
      return ttlMs.get(key) ?? -1;
    },
  };
  return { store, counts, ttlMs };
}

describe("checkRateLimitWith (ventana fija)", () => {
  it("primer hit: permite y setea la expiración de la ventana", async () => {
    const { store, ttlMs } = makeStore();
    const expireSpy = vi.spyOn(store, "expire");

    const res = await checkRateLimitWith(store, "rl:user", 3, 60);

    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(2);
    expect(res.limit).toBe(3);
    expect(expireSpy).toHaveBeenCalledWith("rl:user", 60);
    expect(ttlMs.get("rl:user")).toBe(60_000);
  });

  it("dentro del límite: permite y descuenta el remaining", async () => {
    const { store } = makeStore();

    await checkRateLimitWith(store, "k", 3, 60);
    const second = await checkRateLimitWith(store, "k", 3, 60);
    const third = await checkRateLimitWith(store, "k", 3, 60);

    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("excede el límite: bloquea (allowed=false) y remaining no baja de 0", async () => {
    const { store } = makeStore();

    for (let i = 0; i < 3; i++) await checkRateLimitWith(store, "k", 3, 60);
    const blocked = await checkRateLimitWith(store, "k", 3, 60);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("no re-setea la expiración en hits posteriores (ventana fija)", async () => {
    const { store } = makeStore();
    const expireSpy = vi.spyOn(store, "expire");

    await checkRateLimitWith(store, "k", 5, 60);
    await checkRateLimitWith(store, "k", 5, 60);
    await checkRateLimitWith(store, "k", 5, 60);

    // Solo el primer hit setea EXPIRE; los demás leen PTTL.
    expect(expireSpy).toHaveBeenCalledTimes(1);
  });

  it("reporta resetSeconds desde el PTTL restante", async () => {
    const { store, ttlMs } = makeStore();

    await checkRateLimitWith(store, "k", 5, 60);
    // Simula que pasó tiempo: quedan 30s.
    ttlMs.set("k", 30_000);
    const res = await checkRateLimitWith(store, "k", 5, 60);

    expect(res.resetSeconds).toBe(30);
  });
});
