-- CreateTable
CREATE TABLE "BibIndex" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "year" INTEGER,
    "journal" TEXT,
    "doi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BibIndex_doi_key" ON "BibIndex"("doi");

-- CreateIndex
CREATE INDEX "BibIndex_title_idx" ON "BibIndex"("title");

-- CreateIndex
CREATE INDEX "BibIndex_year_idx" ON "BibIndex"("year");
