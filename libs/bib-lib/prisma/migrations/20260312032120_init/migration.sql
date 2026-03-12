CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "pmid" BIGINT NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "language" TEXT,
    "publicationType" TEXT,
    "dateCompleted" TIMESTAMP(3),
    "dateRevised" TIMESTAMP(3),
    "publicationStatus" TEXT,
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "issn" TEXT,
    "issnElectronic" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pubDate" TEXT,
    "pubYear" INTEGER,
    "title" TEXT,
    "isoAbbreviation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "lastName" TEXT,
    "foreName" TEXT,
    "initials" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorArticle" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeshHeading" (
    "id" TEXT NOT NULL,
    "descriptorName" TEXT,
    "qualifierName" TEXT,
    "ui" TEXT,
    "majorTopicYN" BOOLEAN NOT NULL DEFAULT false,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeshHeading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chemical" (
    "id" TEXT NOT NULL,
    "registryNumber" TEXT,
    "nameOfSubstance" TEXT,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chemical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "grantId" TEXT,
    "agency" TEXT,
    "country" TEXT,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleId" (
    "id" TEXT NOT NULL,
    "pubmed" BIGINT,
    "doi" TEXT,
    "pii" TEXT,
    "pmc" TEXT,
    "otherId" TEXT,
    "otherIdType" TEXT,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleId_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_pmid_key" ON "Article"("pmid");

-- CreateIndex
CREATE INDEX "Article_pmid_idx" ON "Article"("pmid");

-- CreateIndex
CREATE INDEX "Article_articleTitle_idx" ON "Article"("articleTitle");

-- CreateIndex
CREATE INDEX "Journal_issn_idx" ON "Journal"("issn");

-- CreateIndex
CREATE INDEX "Journal_title_idx" ON "Journal"("title");

-- CreateIndex
CREATE INDEX "Author_lastName_idx" ON "Author"("lastName");

-- CreateIndex
CREATE INDEX "AuthorArticle_authorId_idx" ON "AuthorArticle"("authorId");

-- CreateIndex
CREATE INDEX "AuthorArticle_articleId_idx" ON "AuthorArticle"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorArticle_authorId_articleId_key" ON "AuthorArticle"("authorId", "articleId");

-- CreateIndex
CREATE INDEX "MeshHeading_descriptorName_idx" ON "MeshHeading"("descriptorName");

-- CreateIndex
CREATE INDEX "MeshHeading_articleId_idx" ON "MeshHeading"("articleId");

-- CreateIndex
CREATE INDEX "Chemical_registryNumber_idx" ON "Chemical"("registryNumber");

-- CreateIndex
CREATE INDEX "Chemical_articleId_idx" ON "Chemical"("articleId");

-- CreateIndex
CREATE INDEX "Grant_grantId_idx" ON "Grant"("grantId");

-- CreateIndex
CREATE INDEX "Grant_articleId_idx" ON "Grant"("articleId");

-- CreateIndex
CREATE INDEX "ArticleId_doi_idx" ON "ArticleId"("doi");

-- CreateIndex
CREATE INDEX "ArticleId_pmc_idx" ON "ArticleId"("pmc");

-- CreateIndex
CREATE INDEX "ArticleId_articleId_idx" ON "ArticleId"("articleId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorArticle" ADD CONSTRAINT "AuthorArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorArticle" ADD CONSTRAINT "AuthorArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeshHeading" ADD CONSTRAINT "MeshHeading_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chemical" ADD CONSTRAINT "Chemical_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleId" ADD CONSTRAINT "ArticleId_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
