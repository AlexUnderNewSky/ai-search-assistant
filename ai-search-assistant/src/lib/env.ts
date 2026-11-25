import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url().default("postgres://postgres:postgres@localhost:5433/ai_search"),
  GROQ_API_KEY: z.string({ error: "missing, copy .env.example to .env.local" }).min(1, "missing, copy .env.example to .env.local"),
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string({ error: "missing, copy .env.example to .env.local" })
    .min(1, "missing, copy .env.example to .env.local"),
  GROQ_SUGGEST_MODEL: z.string().default("llama-3.1-8b-instant"),
  GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  RATE_LIMIT_CHAT_PER_MIN: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_SUGGEST_PER_MIN: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n  ${issues.join("\n  ")}`);
  }
  cached = parsed.data;
  return cached;
}

export const EMBEDDING_DIMENSIONS = 768;
