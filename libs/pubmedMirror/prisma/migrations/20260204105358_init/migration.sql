-- CreateTable
CREATE TABLE "medline_citations" (
    "pmid" INTEGER NOT NULL,
    "dateCompleted" TIMESTAMP(3),
    "dateRevised" TIMESTAMP(3) NOT NULL,
    "citationSubset" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medline_citations_pkey" PRIMARY KEY ("pmid")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" SERIAL NOT NULL,
    "pmid" INTEGER NOT NULL,
    "journal" JSONB NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "pagination" JSONB,
    "language" TEXT,
    "publicationTypes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "lastName" TEXT,
    "foreName" TEXT,
    "initials" TEXT,
    "affiliation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grants" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "grantId" TEXT,
    "acronym" TEXT,
    "agency" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medline_journal_info" (
    "id" SERIAL NOT NULL,
    "pmid" INTEGER NOT NULL,
    "country" TEXT,
    "medlineTA" TEXT,
    "nlmUniqueId" INTEGER,
    "issnLinking" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medline_journal_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chemicals" (
    "id" SERIAL NOT NULL,
    "pmid" INTEGER NOT NULL,
    "registryNumber" TEXT NOT NULL,
    "nameOfSubstance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chemicals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesh_headings" (
    "id" SERIAL NOT NULL,
    "pmid" INTEGER NOT NULL,
    "descriptorName" TEXT NOT NULL,
    "qualifierNames" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesh_headings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pubmed_data" (
    "id" SERIAL NOT NULL,
    "pmid" INTEGER NOT NULL,
    "publicationStatus" TEXT,
    "articleIds" JSONB NOT NULL,
    "history" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pubmed_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_syncs" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileDate" TEXT NOT NULL,
    "recordsCount" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baseline_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medline_citations_dateCompleted_idx" ON "medline_citations"("dateCompleted");

-- CreateIndex
CREATE INDEX "medline_citations_dateRevised_idx" ON "medline_citations"("dateRevised");

-- CreateIndex
CREATE UNIQUE INDEX "articles_pmid_key" ON "articles"("pmid");

-- CreateIndex
CREATE INDEX "articles_pmid_idx" ON "articles"("pmid");

-- CreateIndex
CREATE INDEX "authors_articleId_idx" ON "authors"("articleId");

-- CreateIndex
CREATE INDEX "grants_articleId_idx" ON "grants"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "medline_journal_info_pmid_key" ON "medline_journal_info"("pmid");

-- CreateIndex
CREATE INDEX "medline_journal_info_pmid_idx" ON "medline_journal_info"("pmid");

-- CreateIndex
CREATE INDEX "chemicals_pmid_idx" ON "chemicals"("pmid");

-- CreateIndex
CREATE INDEX "chemicals_registryNumber_idx" ON "chemicals"("registryNumber");

-- CreateIndex
CREATE INDEX "mesh_headings_pmid_idx" ON "mesh_headings"("pmid");

-- CreateIndex
CREATE INDEX "mesh_headings_descriptorName_idx" ON "mesh_headings"("descriptorName");

-- CreateIndex
CREATE UNIQUE INDEX "pubmed_data_pmid_key" ON "pubmed_data"("pmid");

-- CreateIndex
CREATE INDEX "pubmed_data_pmid_idx" ON "pubmed_data"("pmid");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_syncs_fileName_key" ON "baseline_syncs"("fileName");

-- CreateIndex
CREATE INDEX "baseline_syncs_fileDate_idx" ON "baseline_syncs"("fileDate");

-- CreateIndex
CREATE INDEX "baseline_syncs_status_idx" ON "baseline_syncs"("status");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_pmid_fkey" FOREIGN KEY ("pmid") REFERENCES "medline_citations"("pmid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authors" ADD CONSTRAINT "authors_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grants" ADD CONSTRAINT "grants_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medline_journal_info" ADD CONSTRAINT "medline_journal_info_pmid_fkey" FOREIGN KEY ("pmid") REFERENCES "medline_citations"("pmid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chemicals" ADD CONSTRAINT "chemicals_pmid_fkey" FOREIGN KEY ("pmid") REFERENCES "medline_citations"("pmid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesh_headings" ADD CONSTRAINT "mesh_headings_pmid_fkey" FOREIGN KEY ("pmid") REFERENCES "medline_citations"("pmid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubmed_data" ADD CONSTRAINT "pubmed_data_pmid_fkey" FOREIGN KEY ("pmid") REFERENCES "medline_citations"("pmid") ON DELETE CASCADE ON UPDATE CASCADE;
