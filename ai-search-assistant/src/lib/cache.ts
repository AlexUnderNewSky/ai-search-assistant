import { LRUCache } from "lru-cache";

export function createCache<V extends object>(opts: { max: number; ttlMs: number }) {
  const store = new LRUCache<string, V>({ max: opts.max, ttl: opts.ttlMs });
  const inflight = new Map<string, Promise<V>>();
  let hits = 0;
  let misses = 0;

  return {
    async getOrSet(key: string, compute: () => Promise<V>): Promise<{ value: V; hit: boolean }> {
      const existing = store.get(key);
      if (existing !== undefined) {
        hits++;
        return { value: existing, hit: true };
      }
      const pending = inflight.get(key);
      if (pending) {
        hits++;
        return { value: await pending, hit: true };
      }
      misses++;
      const promise = compute()
        .then((value) => {
          store.set(key, value);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return { value: await promise, hit: false };
    },
    stats: () => ({ size: store.size, hits, misses }),
    clear: () => store.clear(),
  };
}

export const normalizeKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
