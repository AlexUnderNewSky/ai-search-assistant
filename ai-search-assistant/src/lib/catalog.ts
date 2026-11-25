import { db, toVector } from "@/lib/db";
import { embedQuery } from "@/lib/ai/embeddings";
import { createCache, normalizeKey } from "@/lib/cache";
import type { Category } from "../../data/categories";

export type Product = {
  id: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  stock: number;
  tags: string[];
  image: string;
};

export type ScoredProduct = Product & { similarity: number };

export type SearchFilters = {
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "rating";
  limit?: number;
};

const columns = () =>
  db()`id, sku, name, brand, category, description, price, rating, stock, tags, image`;

const searchCache = createCache<{ items: ScoredProduct[] }>({ max: 500, ttlMs: 5 * 60 * 1000 });

export async function semanticSearch(query: string, filters: SearchFilters = {}) {
  const key = `${normalizeKey(query)}|${JSON.stringify(filters)}`;
  const { value, hit } = await searchCache.getOrSet(key, async () => {
    const sql = db();
    const embedding = toVector(await embedQuery(query));
    const limit = Math.min(Math.max(filters.limit ?? 6, 1), 12);

    const orderBy =
      filters.sortBy === "price_asc"
        ? sql`price ASC`
        : filters.sortBy === "price_desc"
          ? sql`price DESC`
          : filters.sortBy === "rating"
            ? sql`rating DESC, similarity DESC`
            : sql`similarity DESC`;

    const rows = await sql<ScoredProduct[]>`
      SELECT * FROM (
        SELECT ${columns()}, 1 - (embedding <=> ${embedding}::vector) AS similarity
        FROM products
        WHERE embedding IS NOT NULL
          ${filters.category ? sql`AND category = ${filters.category}` : sql``}
          ${filters.minPrice != null ? sql`AND price >= ${filters.minPrice}` : sql``}
          ${filters.maxPrice != null ? sql`AND price <= ${filters.maxPrice}` : sql``}
          ${filters.minRating != null ? sql`AND rating >= ${filters.minRating}` : sql``}
          ${filters.inStockOnly ? sql`AND stock > 0` : sql``}
        ORDER BY embedding <=> ${embedding}::vector
        LIMIT ${limit}
      ) nearest
      ORDER BY ${orderBy}
    `;
    const items = rows.map((p) => ({ ...p, similarity: Math.round(Number(p.similarity) * 1000) / 1000 }));
    return { items };
  });
  return { items: value.items, cached: hit };
}

export async function getProductsByIds(ids: number[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const sql = db();
  const rows = await sql<Product[]>`SELECT ${columns()} FROM products WHERE id = ANY(${ids}::int[])`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export type QuickMatch = Pick<Product, "id" | "name" | "brand" | "category" | "price" | "image">;

export async function quickMatches(query: string, limit = 4): Promise<QuickMatch[]> {
  const sql = db();
  const q = query.trim();
  return sql<QuickMatch[]>`
    SELECT id, name, brand, category, price, image
    FROM products
    WHERE name ILIKE ${"%" + q + "%"}
       OR brand ILIKE ${q + "%"}
       OR word_similarity(${q}, name) > 0.35
       OR ${q.toLowerCase()} = ANY(tags)
    ORDER BY word_similarity(${q}, name) DESC, rating DESC
    LIMIT ${limit}
  `;
}

export function productEmbeddingText(p: Omit<Product, "id">) {
  return [
    p.name,
    `Brand: ${p.brand}. Category: ${p.category}.`,
    p.description,
    `Tags: ${p.tags.join(", ")}.`,
    `Price: $${p.price}.`,
  ].join("\n");
}

export function toContextItem(p: Product & { similarity?: number }) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    price: p.price,
    rating: p.rating,
    inStock: p.stock > 0,
    tags: p.tags,
    summary: p.description.length > 220 ? p.description.slice(0, 217) + "..." : p.description,
    ...(p.similarity != null ? { relevance: p.similarity } : {}),
  };
}
