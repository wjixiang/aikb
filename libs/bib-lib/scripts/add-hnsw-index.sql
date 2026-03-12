-- Add HNSW index for vector similarity search optimization
-- This index significantly speeds up approximate nearest neighbor queries

CREATE INDEX IF NOT EXISTS "ArticleEmbedding_vector_hnsw_cosine_idx"
ON "ArticleEmbedding"
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX "ArticleEmbedding_vector_hnsw_cosine_idx" IS 'HNSW index for fast cosine similarity search on article embeddings';
