CREATE EXTENSION IF NOT EXISTS vector;
-- CreateTable
CREATE TABLE "chunk_embed_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "item_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "chunking_config" JSONB NOT NULL,
    "embedding_config" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(255),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'WAIT_FOR_CHUNK_EMBED',

    CONSTRAINT "chunk_embed_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "dense_vector_index_group_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "embedding" VECTOR,
    "strategy_metadata" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chunk_embed_groups_item_id_idx" ON "chunk_embed_groups"("item_id");

-- CreateIndex
CREATE INDEX "chunk_embed_groups_status_idx" ON "chunk_embed_groups"("status");

-- CreateIndex
CREATE INDEX "chunk_embed_groups_is_active_idx" ON "chunk_embed_groups"("is_active");

-- CreateIndex
CREATE INDEX "chunk_embed_groups_token_idx" ON "chunk_embed_groups"("token");

-- CreateIndex
CREATE INDEX "item_chunks_item_id_idx" ON "item_chunks"("item_id");

-- CreateIndex
CREATE INDEX "item_chunks_dense_vector_index_group_id_idx" ON "item_chunks"("dense_vector_index_group_id");

-- CreateIndex
CREATE INDEX "item_chunks_index_idx" ON "item_chunks"("index");

-- AddForeignKey
ALTER TABLE "item_chunks" ADD CONSTRAINT "item_chunks_dense_vector_index_group_id_fkey" FOREIGN KEY ("dense_vector_index_group_id") REFERENCES "chunk_embed_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
