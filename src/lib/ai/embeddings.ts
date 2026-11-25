import { embed, embedMany } from "ai";
import { embeddingModel } from "@/lib/ai/models";
import { createCache, normalizeKey } from "@/lib/cache";
import { EMBEDDING_DIMENSIONS } from "@/lib/env";

type TaskType = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";

const googleOptions = (taskType: TaskType) => ({
  google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
});

const queryCache = createCache<{ embedding: number[] }>({ max: 1_000, ttlMs: 60 * 60 * 1000 });

export async function embedQuery(text: string): Promise<number[]> {
  const { value } = await queryCache.getOrSet(normalizeKey(text), async () => {
    const { embedding } = await embed({
      model: embeddingModel(),
      value: text,
      providerOptions: googleOptions("RETRIEVAL_QUERY"),
    });
    return { embedding };
  });
  return value.embedding;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values: texts,
    maxParallelCalls: 2,
    providerOptions: googleOptions("RETRIEVAL_DOCUMENT"),
  });
  return embeddings;
}
