-- Add ArticleEmbedding table for vector embeddings
-- This table stores article embeddings for semantic search

CREATE TABLE IF NOT EXISTS "ArticleEmbedding" (
    id          TEXT   NOT NULL DEFAULT gen_random_uuid()::text,
    "articleId" TEXT   NOT NULL,
    provider    TEXT   NOT NULL,
    model       TEXT   NOT NULL,
    dimension   INTEGER NOT NULL,
    text        TEXT   NOT NULL,
    vector      vector,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleEmbedding_pkey" PRIMARY KEY (id)
);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "ArticleEmbedding_articleId_provider_model_key"
ON "ArticleEmbedding"("articleId", provider, model);

-- Indexes
CREATE INDEX IF NOT EXISTS "ArticleEmbedding_articleId_idx"
ON "ArticleEmbedding"("articleId");

CREATE INDEX IF NOT EXISTS "ArticleEmbedding_provider_model_idx"
ON "ArticleEmbedding"(provider, model);

COMMENT ON TABLE "ArticleEmbedding" IS 'Stores vector embeddings for articles, used in semantic search';
