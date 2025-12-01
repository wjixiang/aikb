CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "batchSize" INTEGER NOT NULL,
    "maxRetries" INTEGER NOT NULL,
    "timeout" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "vector" vector,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entities_description_idx" ON "entities"("description");

-- CreateIndex
CREATE INDEX "nomenclatures_entityId_idx" ON "nomenclatures"("entityId");

-- CreateIndex
CREATE INDEX "nomenclatures_name_idx" ON "nomenclatures"("name");

-- CreateIndex
CREATE INDEX "nomenclatures_language_idx" ON "nomenclatures"("language");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_entityId_key" ON "embeddings"("entityId");

-- CreateIndex
CREATE INDEX "embedding_vector_index" ON "embeddings"("vector");

-- AddForeignKey
ALTER TABLE "nomenclatures" ADD CONSTRAINT "nomenclatures_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
