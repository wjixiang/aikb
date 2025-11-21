-- CreateTable
CREATE TABLE "authors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "middle_name" VARCHAR(255),

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "citation_style" VARCHAR(50) NOT NULL,
    "citation_text" TEXT NOT NULL,
    "date_generated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parent_collection_id" UUID,
    "date_added" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modified" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_archives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_hash" VARCHAR(255) NOT NULL,
    "add_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "s3_key" VARCHAR(500) NOT NULL,
    "page_count" INTEGER NOT NULL,
    "word_count" INTEGER,

    CONSTRAINT "item_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_authors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,

    CONSTRAINT "item_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,

    CONSTRAINT "item_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(500) NOT NULL,
    "abstract" TEXT,
    "publication_year" INTEGER,
    "publisher" VARCHAR(255),
    "isbn" VARCHAR(20),
    "doi" VARCHAR(255),
    "url" VARCHAR(500),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "date_added" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modified" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" VARCHAR(10),
    "markdown_content" TEXT,
    "markdown_updated_date" TIMESTAMPTZ(6),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markdowns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modified" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(10) NOT NULL,
    "class" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(255) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "question" TEXT,
    "main_question" TEXT,
    "options" JSONB,
    "answer" JSONB,
    "analysis" JSONB,
    "source" VARCHAR(255),
    "specific_data" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "chunk_embed_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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
    "embedding" DOUBLE PRECISION[],
    "strategy_metadata" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_authors_item_id_author_id_key" ON "item_authors"("item_id", "author_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_collections_item_id_collection_id_key" ON "item_collections"("item_id", "collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "markdowns_item_id_key" ON "markdowns"("item_id");

-- CreateIndex
CREATE INDEX "chunk_embed_groups_item_id_idx" ON "chunk_embed_groups"("item_id");

-- CreateIndex
CREATE INDEX "chunk_embed_groups_status_idx" ON "chunk_embed_groups"("status");

-- CreateIndex
CREATE INDEX "chunk_embed_groups_is_active_idx" ON "chunk_embed_groups"("is_active");

-- CreateIndex
CREATE INDEX "item_chunks_item_id_idx" ON "item_chunks"("item_id");

-- CreateIndex
CREATE INDEX "item_chunks_dense_vector_index_group_id_idx" ON "item_chunks"("dense_vector_index_group_id");

-- CreateIndex
CREATE INDEX "item_chunks_index_idx" ON "item_chunks"("index");

-- CreateIndex
CREATE INDEX "item_chunks_embedding_idx" ON "item_chunks" USING HASH ("embedding");

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_parent_collection_id_fkey" FOREIGN KEY ("parent_collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_archives" ADD CONSTRAINT "item_archives_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_authors" ADD CONSTRAINT "item_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_authors" ADD CONSTRAINT "item_authors_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_collections" ADD CONSTRAINT "item_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_collections" ADD CONSTRAINT "item_collections_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markdowns" ADD CONSTRAINT "markdowns_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_embed_groups" ADD CONSTRAINT "chunk_embed_groups_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_chunks" ADD CONSTRAINT "item_chunks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_chunks" ADD CONSTRAINT "item_chunks_dense_vector_index_group_id_fkey" FOREIGN KEY ("dense_vector_index_group_id") REFERENCES "chunk_embed_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
