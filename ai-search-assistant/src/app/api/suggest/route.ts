import { connection } from "next/server";
import { z } from "zod";
import { getSuggestions } from "@/lib/ai/suggest";
import { env } from "@/lib/env";
import { serverError } from "@/lib/http";
import { clientKey, createRateLimiter, rateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";

const QuerySchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(100),
});

let limiter: ReturnType<typeof createRateLimiter> | undefined;

export async function GET(req: Request) {
  await connection();

  try {
    limiter ??= createRateLimiter({ limit: env().RATE_LIMIT_SUGGEST_PER_MIN, windowMs: 60_000 });
    const rl = limiter(clientKey(req));
    if (!rl.success) return tooManyRequests(rl);

    const parsed = QuerySchema.safeParse({ q: new URL(req.url).searchParams.get("q") ?? "" });
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const data = await getSuggestions(parsed.data.q, req.signal);
    return Response.json(data, {
      headers: { ...rateLimitHeaders(rl), "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return serverError("suggest", err, "Suggestions are unavailable right now.");
  }
}
