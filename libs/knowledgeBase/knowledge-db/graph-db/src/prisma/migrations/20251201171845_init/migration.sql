-- CreateTable
CREATE TABLE "vertices" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "vertices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edges" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "type" TEXT NOT NULL,
    "inId" TEXT NOT NULL,
    "outId" TEXT NOT NULL,

    CONSTRAINT "edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vertices_content_idx" ON "vertices"("content");

-- CreateIndex
CREATE INDEX "vertices_type_idx" ON "vertices"("type");

-- CreateIndex
CREATE INDEX "vertices_deletedAt_idx" ON "vertices"("deletedAt");

-- CreateIndex
CREATE INDEX "edges_type_idx" ON "edges"("type");

-- CreateIndex
CREATE INDEX "edges_inId_idx" ON "edges"("inId");

-- CreateIndex
CREATE INDEX "edges_outId_idx" ON "edges"("outId");

-- CreateIndex
CREATE INDEX "edges_deletedAt_idx" ON "edges"("deletedAt");

-- CreateIndex
CREATE INDEX "edges_inId_outId_idx" ON "edges"("inId", "outId");

-- CreateIndex
CREATE INDEX "edges_type_inId_idx" ON "edges"("type", "inId");

-- CreateIndex
CREATE INDEX "edges_type_outId_idx" ON "edges"("type", "outId");

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_inId_fkey" FOREIGN KEY ("inId") REFERENCES "vertices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_outId_fkey" FOREIGN KEY ("outId") REFERENCES "vertices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
