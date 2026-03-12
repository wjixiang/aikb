-- Performance optimization: Add pgvector HNSW indexes for similarity search
-- HNSW indexes provide faster approximate nearest neighbor search

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index on ArticleEmbedding vector column for cosine similarity
-- This index significantly speeds up vector similarity searches
-- m: number of connections per layer (default 16)
-- ef_construction: size of dynamic candidate list during construction (default 64)
CREATE INDEX IF NOT EXISTS "ArticleEmbedding_vector_hnsw_cosine_idx"
ON "ArticleEmbedding"
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create separate HNSW indexes for different similarity types if needed
-- For euclidean distance:
-- CREATE INDEX IF NOT EXISTS "ArticleEmbedding_vector_hnsw_euclidean_idx"
-- ON "ArticleEmbedding"
-- USING hnsw (vector vector_l2_ops)
-- WITH (m = 16, ef_construction = 64);

-- For dot product:
-- CREATE INDEX IF NOT EXISTS "ArticleEmbedding_vector_hnsw_dot_idx"
-- ON "ArticleEmbedding"
-- USING hnsw (vector vector_ip_ops)
-- WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX "ArticleEmbedding_vector_hnsw_cosine_idx" IS 'HNSW index for fast cosine similarity search on article embeddings';

-- Note: For best performance, ensure embeddings are stored with consistent dimensions
-- Different embedding models have different dimensions (e.g., OpenAI ada-002 = 1536, Alibaba v4 = 1024)
