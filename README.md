# Shelfwise: AI Search Assistant

A pet project where I built AI-powered search over a product catalog. Query suggestions show up while you type, natural-language questions get answers grounded in the catalog through retrieval-augmented generation (RAG), and recommendations come back as structured product cards instead of a wall of text.

**Stack:** TypeScript, Next.js 16 (App Router), React 19, Vercel AI SDK, Groq (Llama 3.1), Google Gemini, PostgreSQL + pgvector, Zod, Tailwind CSS 4

## Why I built it

I wanted to go beyond "chat with an LLM" and build the parts a real AI search feature needs: low-latency suggestions, retrieval that is actually grounded in data, structured output the UI can render, and the boring but important pieces like caching, rate limiting and guardrails.

## What I did

### Two models, each picked for its job
- **Groq + Llama 3.1 8B for suggestions.** Type-ahead has to feel instant, so I used Groq for its latency. Requests are debounced (220 ms), stale ones are aborted with `AbortController`, and the LLM call has a hard 2.5 s budget. If Groq is slow or down, the endpoint falls back to plain database matches, so the dropdown never breaks.
- **Gemini for embeddings and answers.** `gemini-embedding-001` (truncated to 768 dimensions) for vectors, and Gemini 2.5 Flash for the answers, streamed to the client through the Vercel AI SDK UI message stream.

### RAG on PostgreSQL + pgvector
- I designed the `products` table with a `vector(768)` column, an HNSW index (cosine distance) for semantic search and a `pg_trgm` index for fast name matching.
- I wrote a seed script that embeds every product with the `RETRIEVAL_DOCUMENT` task type and upserts it. It skips products that already have an embedding, and `--force` re-embeds everything.
- On every question the server embeds the query (`RETRIEVAL_QUERY`), pulls the nearest products from pgvector and passes them to the model as context.

### Tool calling with Zod
I gave the model three tools, each with a Zod schema for its parameters:
- `searchCatalog`: semantic search plus category, price range, minimum rating, in-stock and sort filters, all applied in SQL. It gets used when the pre-retrieved context is not enough ("kitchen stuff under $100 rated 4.5+").
- `getProductDetails`: full product info by id.
- `showRecommendations`: structured output (title + products + a reason for each) that the UI renders as cards. The tool loads the products from the database by id, so the cards always show real names, prices and stock. If the model makes up an id, that card is simply dropped.

The UI shows each tool call live as a small chip with the applied filters.

### Prompt engineering and guardrails
- The system prompt has explicit grounding rules (no invented products, prices or specs), a tool-usage policy, a style guide and few-shot examples.
- Guardrails: off-topic requests are politely declined, attempts to override instructions or extract the prompt are refused, system messages coming from the client are dropped, and input length is capped.
- The assistant answers in the user's language. Try asking in Russian.

### Caching and rate limiting
- An LRU + TTL cache that also de-duplicates concurrent identical requests: query embeddings (1 h), vector search results (5 min), suggestions (10 min).
- A sliding-window rate limiter per client IP with separate limits for chat and suggestions. Responses include `X-RateLimit-*` and `Retry-After` headers.

### Frontend
- An accessible combobox (ARIA roles, arrow-key navigation, Enter, Esc) that highlights the part of each suggestion you haven't typed yet.
- Streaming answers, skeleton cards while tools run, stop and retry, a light/dark theme and a mobile layout.

### Quality
- All environment variables are validated with Zod, and in development errors come back with a hint (e.g. "Is PostgreSQL running?").
- Unit tests for the rate limiter, the cache, suggestion parsing and the tool schemas (`node:test`).
- Strict TypeScript, with message types shared between server and client and inferred from the tool definitions.

## How it works

```
Typing:   SearchBox ─(debounce, abort)─▶ GET /api/suggest
                                         ├─ rate limit ─▶ cache
                                         ├─ pg_trgm product matches
                                         └─ Groq Llama 3.1 (2.5 s budget, DB fallback)

Asking:   useChat ─▶ POST /api/chat
                     ├─ rate limit ─▶ Zod validation
                     ├─ Gemini embedding ─▶ pgvector top-k ─▶ system prompt context
                     └─ Gemini 2.5 Flash ⇄ tools (searchCatalog, getProductDetails, showRecommendations)
                        └─▶ streamed text + tool results ─▶ product cards
```

## Project structure

```
src/
  app/api/chat/route.ts      chat endpoint: RAG + tool calling, streaming
  app/api/suggest/route.ts   type-ahead endpoint
  lib/ai/models.ts           Groq and Gemini providers
  lib/ai/embeddings.ts       embeddings with caching
  lib/ai/prompts.ts          system prompts, guardrails, few-shot examples
  lib/ai/tools.ts            Zod schemas, tools, shared message types
  lib/ai/suggest.ts          suggestion pipeline with timeout and fallback
  lib/catalog.ts             vector search, trigram matches
  lib/cache.ts               LRU/TTL cache
  lib/rate-limit.ts          sliding-window rate limiter
  components/                search box, message rendering, product cards
db/schema.sql                table and indexes
data/products.ts             demo catalog (51 products, made-up brands)
scripts/seed.ts              embedding + upsert script
```

## Running it locally

You need Node 20+, Docker and two free API keys: [Groq](https://console.groq.com/keys) and [Google AI Studio](https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env.local   # add GROQ_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY
npm run db:up                # PostgreSQL 17 with pgvector on localhost:5433
npm run db:seed              # create the schema and embed the catalog
npm run dev                  # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:up` / `db:down` | start / stop the database container |
| `npm run db:seed` | schema + embeddings (`-- --force` to re-embed everything) |
| `npm test` | unit tests |
| `npm run typecheck` / `lint` | TypeScript / ESLint |

Models can be swapped through env variables (`GROQ_SUGGEST_MODEL`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`), see `.env.example`.

## Things to try

- "Headphones for long flights under $300"
- "Kitchen stuff under $100 rated 4.5+" (watch the filters in the tool chip)
- "Compare the laptops for video editing"
- "Подбери робот-пылесос для дома с собакой"
- "Write me a Python script" (off-topic, declined)

## What I'd do next

- Move the cache and rate limiter to Redis so they work across multiple instances.
- Hybrid ranking: full-text search (`tsvector`) combined with vectors through reciprocal rank fusion.
- An evaluation set of queries with expected products to measure retrieval quality when prompts or models change.
