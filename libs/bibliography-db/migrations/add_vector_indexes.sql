-- Add pgvector extension if not already installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing hash index that conflicts with vector operations
DROP INDEX IF EXISTS item_chunks_embedding_idx;

-- First, alter the embedding column to use vector type
-- This assumes vectors are 1024 dimensions (adjust if needed)
ALTER TABLE item_chunks 
ALTER COLUMN embedding TYPE vector(1024) 
USING embedding::vector(1024);

-- Create basic vector index for similarity search
CREATE INDEX IF NOT EXISTS item_chunks_embedding_vector_idx 
ON item_chunks 
USING ivfflat (embedding vector_cosine_ops);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS item_chunks_composite_idx 
ON item_chunks (item_id, dense_vector_index_group_id, index);

-- Create index on metadata for JSON filtering
CREATE INDEX IF NOT EXISTS item_chunks_metadata_gin_idx 
ON item_chunks 
USING GIN (metadata);