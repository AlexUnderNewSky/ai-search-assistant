import postgres from "postgres";

declare global {
  var __pg: ReturnType<typeof postgres> | undefined;
}

export function db() {
  if (!globalThis.__pg) {
    globalThis.__pg = postgres(
      process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/ai_search",
      {
        max: 10,
        idle_timeout: 30,
        types: {
          numeric: {
            to: 1700,
            from: [1700],
            serialize: (v: number) => String(v),
            parse: (v: string) => Number(v),
          },
        },
      },
    );
  }
  return globalThis.__pg;
}

export const toVector = (embedding: number[]) => `[${embedding.join(",")}]`;
