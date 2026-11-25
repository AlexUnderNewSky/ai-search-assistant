export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  let lastSweep = Date.now();

  function sweep(now: number) {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, timestamps] of hits) {
      if (timestamps.every((t) => now - t >= windowMs)) hits.delete(key);
    }
  }

  return function check(key: string, now = Date.now()): RateLimitResult {
    sweep(now);
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const success = recent.length < limit;
    if (success) recent.push(now);
    hits.set(key, recent);
    return {
      success,
      limit,
      remaining: Math.max(0, limit - recent.length),
      resetAt: (recent[0] ?? now) + windowMs,
    };
  };
}

export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
    ...(r.success ? {} : { "Retry-After": String(Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))) }),
  };
}

export function tooManyRequests(r: RateLimitResult) {
  return Response.json(
    { error: "Too many requests — please slow down a little.", retryAfter: rateLimitHeaders(r)["Retry-After"] },
    { status: 429, headers: rateLimitHeaders(r) },
  );
}
