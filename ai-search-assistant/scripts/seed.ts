import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { readFile } from "node:fs/promises";
import path from "node:path";
import { products } from "../data/products";
import { db, toVector } from "../src/lib/db";
import { embedDocuments } from "../src/lib/ai/embeddings";
import { productEmbeddingText } from "../src/lib/catalog";

const BATCH = 20;
const force = process.argv.includes("--force");

async function main() {
  const sql = db();
  const schema = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await sql.unsafe(schema);
  console.log("✓ schema applied");

  const existing = await sql<{ sku: string }[]>`SELECT sku FROM products WHERE embedding IS NOT NULL`;
  const done = new Set(existing.map((r) => r.sku));
  const todo = force ? products : products.filter((p) => !done.has(p.sku));

  console.log(`→ ${todo.length} of ${products.length} products need embeddings${force ? " (forced)" : ""}`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const embeddings = await embedDocuments(batch.map(productEmbeddingText));

    await sql.begin(async (tx) => {
      for (const [j, p] of batch.entries()) {
        await tx`
          INSERT INTO products (sku, name, brand, category, description, price, rating, stock, tags, image, embedding)
          VALUES (${p.sku}, ${p.name}, ${p.brand}, ${p.category}, ${p.description}, ${p.price},
                  ${p.rating}, ${p.stock}, ${p.tags}, ${p.image}, ${toVector(embeddings[j])}::vector)
          ON CONFLICT (sku) DO UPDATE SET
            name = EXCLUDED.name, brand = EXCLUDED.brand, category = EXCLUDED.category,
            description = EXCLUDED.description, price = EXCLUDED.price, rating = EXCLUDED.rating,
            stock = EXCLUDED.stock, tags = EXCLUDED.tags, image = EXCLUDED.image,
            embedding = EXCLUDED.embedding
        `;
      }
    });
    console.log(`  ✓ ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }

  const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM products`;
  console.log(`✓ done, ${count} products in catalog`);
  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ seed failed:", err instanceof Error ? err.message : err);
  await db().end({ timeout: 1 });
  process.exit(1);
});
