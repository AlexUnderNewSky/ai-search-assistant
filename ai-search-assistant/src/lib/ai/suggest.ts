import { generateText } from "ai";
import { suggestModel } from "@/lib/ai/models";
import { suggestSystemPrompt } from "@/lib/ai/prompts";
import { createCache, normalizeKey } from "@/lib/cache";
import { quickMatches, type QuickMatch } from "@/lib/catalog";

export type SuggestResponse = {
  query: string;
  suggestions: string[];
  products: QuickMatch[];
  source: "ai" | "fallback";
  cached: boolean;
  ms: number;
};

const cache = createCache<Omit<SuggestResponse, "cached" | "ms">>({ max: 2_000, ttlMs: 10 * 60 * 1000 });

const AI_TIMEOUT_MS = 2_500;

export function parseSuggestions(text: string, query: string): string[] {
  const seen = new Set<string>([normalizeKey(query)]);
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((line) => line.length >= 2 && line.length <= 80)
    .filter((line) => {
      const key = normalizeKey(line);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

export async function getSuggestions(query: string, signal?: AbortSignal): Promise<SuggestResponse> {
  const started = performance.now();

  const { value, hit } = await cache.getOrSet(normalizeKey(query), async () => {
    const products = await quickMatches(query).catch(() => [] as QuickMatch[]);

    try {
      const { text } = await generateText({
        model: suggestModel(),
        instructions: suggestSystemPrompt(),
        prompt: `Matching products: ${products.map((p) => p.name).join("; ") || "none"}\nInput: "${query}"`,
        temperature: 0.4,
        maxOutputTokens: 120,
        maxRetries: 0,
        abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(AI_TIMEOUT_MS)]) : AbortSignal.timeout(AI_TIMEOUT_MS),
      });
      return { query, suggestions: parseSuggestions(text, query), products, source: "ai" as const };
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn("[suggest] LLM unavailable, falling back to DB matches:", (err as Error).message);
      return {
        query,
        suggestions: products.map((p) => p.name.toLowerCase()),
        products,
        source: "fallback" as const,
      };
    }
  });

  return { ...value, cached: hit, ms: Math.round(performance.now() - started) };
}
