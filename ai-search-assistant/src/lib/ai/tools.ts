import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";
import { CATEGORIES } from "../../../data/categories";
import { getProductsByIds, semanticSearch, toContextItem, type Product } from "@/lib/catalog";

export const searchCatalogInput = z
  .object({
    query: z
      .string()
      .min(1)
      .max(200)
      .describe("Natural-language description of what the customer wants, e.g. 'quiet keyboard for coding'"),
    category: z.enum(CATEGORIES).optional().describe("Restrict to one catalog category"),
    minPrice: z.number().nonnegative().optional().describe("Minimum price in USD"),
    maxPrice: z.number().positive().optional().describe("Maximum price in USD"),
    minRating: z.number().min(0).max(5).optional().describe("Minimum average rating, 0-5"),
    inStockOnly: z.boolean().optional().describe("Only return products that are in stock"),
    sortBy: z.enum(["relevance", "price_asc", "price_desc", "rating"]).optional(),
    limit: z.number().int().min(1).max(10).optional().describe("How many results to return (default 6)"),
  })
  .refine((v) => v.minPrice == null || v.maxPrice == null || v.minPrice <= v.maxPrice, {
    message: "minPrice must be <= maxPrice",
    path: ["minPrice"],
  });

export const getProductDetailsInput = z.object({
  productIds: z.array(z.number().int().positive()).min(1).max(5).describe("Product ids from context or search results"),
});

export const recommendationSchema = z.object({
  title: z.string().min(1).max(80).describe("Short heading for the cards, e.g. 'Best picks for long flights'"),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        reason: z.string().min(1).max(160).describe("Why this product fits the customer's needs, one sentence"),
      }),
    )
    .min(1)
    .max(4),
});

export const tools = {
  searchCatalog: tool({
    description:
      "Semantic search over the product catalog with optional filters (category, price range, rating, stock, sort).",
    inputSchema: searchCatalogInput,
    execute: async ({ query, ...filters }) => {
      const { items, cached } = await semanticSearch(query, filters);
      return { count: items.length, cached, items: items.map(toContextItem) };
    },
  }),

  getProductDetails: tool({
    description: "Get full details (description, stock, tags) for specific products by id.",
    inputSchema: getProductDetailsInput,
    execute: async ({ productIds }) => {
      const products = await getProductsByIds(productIds);
      return { products };
    },
  }),

  showRecommendations: tool({
    description:
      "Render product recommendation cards in the UI. Call this whenever you recommend or compare specific products.",
    inputSchema: recommendationSchema,
    execute: async ({ title, items }) => {
      const products = await getProductsByIds(items.map((i) => i.productId));
      const byId = new Map(products.map((p) => [p.id, p]));
      const cards = items
        .map((i) => ({ reason: i.reason, product: byId.get(i.productId) }))
        .filter((c): c is { reason: string; product: Product } => Boolean(c.product));
      return { title, cards, dropped: items.length - cards.length };
    },
    toModelOutput: ({ output }) => ({
      type: "json",
      value: {
        rendered: output.cards.map((c) => c.product.name),
        droppedUnknownIds: output.dropped,
      },
    }),
  }),
};

export type ChatTools = InferUITools<typeof tools>;
export type ChatMessage = UIMessage<unknown, UIDataTypes, ChatTools>;
export type RecommendationOutput = ChatTools["showRecommendations"]["output"];
