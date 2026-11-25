import { convertToModelMessages, isStepCount, streamText } from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai/models";
import { chatSystemPrompt } from "@/lib/ai/prompts";
import { tools, type ChatMessage } from "@/lib/ai/tools";
import { semanticSearch, toContextItem } from "@/lib/catalog";
import { env } from "@/lib/env";
import { serverError } from "@/lib/http";
import { clientKey, createRateLimiter, rateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";

const MAX_USER_CHARS = 500;

const BodySchema = z.object({
  messages: z
    .array(
      z.looseObject({
        id: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.looseObject({ type: z.string() })),
      }),
    )
    .min(1)
    .max(40),
});

let limiter: ReturnType<typeof createRateLimiter> | undefined;

function lastUserText(messages: ChatMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return (
    last?.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .trim() ?? ""
  );
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    return serverError("chat", err, "The assistant is unavailable right now.");
  }
}

async function handle(req: Request) {
  limiter ??= createRateLimiter({ limit: env().RATE_LIMIT_CHAT_PER_MIN, windowMs: 60_000 });
  const rl = limiter(clientKey(req));
  if (!rl.success) return tooManyRequests(rl);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const messages = (parsed.data.messages as unknown as ChatMessage[]).filter((m) => m.role !== "system");
  const question = lastUserText(messages);
  if (!question) return Response.json({ error: "Empty question" }, { status: 400 });
  if (question.length > MAX_USER_CHARS) {
    return Response.json({ error: `Please keep questions under ${MAX_USER_CHARS} characters.` }, { status: 413 });
  }

  const { items } = await semanticSearch(question, { limit: 8 });
  const context = items.map(toContextItem);

  const result = streamText({
    model: chatModel(),
    instructions: chatSystemPrompt(context),
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: isStepCount(5),
    temperature: 0.3,
    maxOutputTokens: 1024,
    abortSignal: req.signal,
    onError: ({ error }) => console.error("[chat]", error),
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    headers: rateLimitHeaders(rl),
    onError: (error) =>
      error instanceof Error && /quota|rate|429/i.test(error.message)
        ? "The AI provider is rate-limiting us. Please try again in a minute."
        : "Something went wrong while generating the answer.",
  });
}
