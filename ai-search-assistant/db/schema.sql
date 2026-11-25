CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  sku          TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  brand        TEXT NOT NULL,
  category     TEXT NOT NULL,
  description  TEXT NOT NULL,
  price        NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  rating       NUMERIC(2, 1) NOT NULL CHECK (rating BETWEEN 0 AND 5),
  stock        INTEGER NOT NULL DEFAULT 0,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  image        TEXT NOT NULL DEFAULT '📦',
  embedding    vector(768),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_embedding_hnsw
  ON products USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_price_idx ON products (price);
