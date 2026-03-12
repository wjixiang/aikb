-- Performance optimization: Add GIN index for full-text search
-- This index significantly improves keyword search performance on article titles

-- Create GIN index on Article title using pg_trgm for trigram-based search
CREATE INDEX IF NOT EXISTS "Article_articleTitle_gin_idx" ON "Article" USING gin ("articleTitle" gin_trgm_ops);

-- Create GIN index on Journal title for faster journal searches
CREATE INDEX IF NOT EXISTS "Journal_title_gin_idx" ON "Journal" USING gin ("title" gin_trgm_ops);

-- Create GIN index on Author lastName for faster author searches
CREATE INDEX IF NOT EXISTS "Author_lastName_gin_idx" ON "Author" USING gin ("lastName" gin_trgm_ops);

-- Create GIN index on MeSH descriptor names for faster MeSH term searches
CREATE INDEX IF NOT EXISTS "MeshHeading_descriptorName_gin_idx" ON "MeshHeading" USING gin ("descriptorName" gin_trgm_ops);

COMMENT ON INDEX "Article_articleTitle_gin_idx" IS 'GIN index for fast trigram-based keyword search on article titles';
