import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rate-limit";
import { createCache, normalizeKey } from "./cache";
import { parseSuggestions } from "./ai/suggest";
import { recommendationSchema, searchCatalogInput } from "./ai/tools";

test("rate limiter allows `limit` requests per window, then blocks", () => {
  const check = createRateLimiter({ limit: 3, windowMs: 1000 });
  const t0 = 1_000_000;
  assert.equal(check("ip", t0).success, true);
  assert.equal(check("ip", t0 + 1).success, true);
  assert.equal(check("ip", t0 + 2).remaining, 0);
  assert.equal(check("ip", t0 + 3).success, false);
  assert.equal(check("other-ip", t0 + 3).success, true, "keys are isolated");
  assert.equal(check("ip", t0 + 1001).success, true, "window slides");
});

test("cache de-duplicates concurrent calls and serves hits", async () => {
  const cache = createCache<{ n: number }>({ max: 10, ttlMs: 60_000 });
  let calls = 0;
  const compute = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return { n: 42 };
  };
  const [a, b] = await Promise.all([cache.getOrSet("k", compute), cache.getOrSet("k", compute)]);
  assert.equal(calls, 1);
  assert.equal(a.value.n, 42);
  assert.equal(b.hit, true);
  assert.equal((await cache.getOrSet("k", compute)).hit, true);
  assert.equal(normalizeKey("  Wireless   Headphones "), "wireless headphones");
});

test("parseSuggestions cleans numbering, quotes, duplicates and the query itself", () => {
  const raw = `1. headphones for running\n- "headphones under $150"\nheadphones for running\nhead\n\n• headlamp for camping`;
  assert.deepEqual(parseSuggestions(raw, "head"), [
    "headphones for running",
    "headphones under $150",
    "headlamp for camping",
  ]);
});

test("tool schemas validate model-generated arguments", () => {
  assert.equal(searchCatalogInput.safeParse({ query: "tent", maxPrice: 300, category: "Outdoor" }).success, true);
  assert.equal(searchCatalogInput.safeParse({ query: "tent", minPrice: 500, maxPrice: 100 }).success, false);
  assert.equal(searchCatalogInput.safeParse({ query: "tent", category: "Cars" }).success, false);
  assert.equal(recommendationSchema.safeParse({ title: "Picks", items: [] }).success, false);
});
