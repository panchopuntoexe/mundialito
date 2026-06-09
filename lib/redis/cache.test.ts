import { describe, expect, it, vi } from "vitest";
import { cachedWith, type CacheStore } from "@/lib/redis/cache";

/** Store en memoria que cumple CacheStore para los tests. */
function makeStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const store: CacheStore = {
    get: async <T>(key: string) =>
      data.has(key) ? (data.get(key) as T) : null,
    set: async (key, value) => {
      data.set(key, value);
      return "OK";
    },
  };
  return { store, data };
}

describe("cachedWith (cache-aside)", () => {
  it("miss: ejecuta el fetcher, guarda con TTL y devuelve el valor", async () => {
    const { store, data } = makeStore();
    const fetcher = vi.fn(async () => ({ value: 42 }));
    const setSpy = vi.spyOn(store, "set");

    const result = await cachedWith(store, "k", 60, fetcher);

    expect(result).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith("k", { value: 42 }, { ex: 60 });
    expect(data.get("k")).toEqual({ value: 42 });
  });

  it("hit: devuelve lo cacheado y NO ejecuta el fetcher", async () => {
    const { store } = makeStore({ k: { value: "cached" } });
    const fetcher = vi.fn(async () => ({ value: "fresh" }));

    const result = await cachedWith(store, "k", 60, fetcher);

    expect(result).toEqual({ value: "cached" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("dos llamadas seguidas: la segunda es hit (fetcher una sola vez)", async () => {
    const { store } = makeStore();
    const fetcher = vi.fn(async () => "v");

    await cachedWith(store, "k", 30, fetcher);
    const second = await cachedWith(store, "k", 30, fetcher);

    expect(second).toBe("v");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
