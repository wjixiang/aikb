CREATE EXTENSION IF NOT EXISTS vector;
-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entities" TEXT[],
    "documentEmbeddingId" TEXT NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "documentId" TEXT,

    CONSTRAINT "record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nomenclatures" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT,
    "language" TEXT NOT NULL,

    CONSTRAINT "nomenclatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "definition" TEXT NOT NULL,
    "documentEmbeddingId" TEXT,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityEmbedding" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "vector" vector,

    CONSTRAINT "EntityEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentEmbedding" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "vector" vector,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "DocumentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_id_key" ON "document"("id");

-- CreateIndex
CREATE UNIQUE INDEX "record_id_key" ON "record"("id");

-- CreateIndex
CREATE INDEX "nomenclatures_entityId_idx" ON "nomenclatures"("entityId");

-- CreateIndex
CREATE INDEX "nomenclatures_name_idx" ON "nomenclatures"("name");

-- CreateIndex
CREATE INDEX "nomenclatures_language_idx" ON "nomenclatures"("language");

-- CreateIndex
CREATE INDEX "entities_definition_idx" ON "entities"("definition");

-- CreateIndex
CREATE UNIQUE INDEX "EntityEmbedding_entityId_key" ON "EntityEmbedding"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEmbedding_documentId_key" ON "DocumentEmbedding"("documentId");

-- AddForeignKey
ALTER TABLE "record" ADD CONSTRAINT "record_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomenclatures" ADD CONSTRAINT "nomenclatures_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityEmbedding" ADD CONSTRAINT "EntityEmbedding_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEmbedding" ADD CONSTRAINT "DocumentEmbedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
