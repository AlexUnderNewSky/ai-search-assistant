import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/lib/env";

export function suggestModel() {
  const e = env();
  return createGroq({ apiKey: e.GROQ_API_KEY })(e.GROQ_SUGGEST_MODEL);
}

export function chatModel() {
  const e = env();
  return createGoogleGenerativeAI({ apiKey: e.GOOGLE_GENERATIVE_AI_API_KEY })(e.GEMINI_CHAT_MODEL);
}

export function embeddingModel() {
  const e = env();
  return createGoogleGenerativeAI({ apiKey: e.GOOGLE_GENERATIVE_AI_API_KEY }).embeddingModel(
    e.GEMINI_EMBEDDING_MODEL,
  );
}
