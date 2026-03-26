-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Library" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleRef" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "pmid" BIGINT NOT NULL,
    "pdfUrl" TEXT,
    "pdfPageCount" INTEGER,
    "pdfFileSize" BIGINT,
    "pdfUploadedAt" TIMESTAMP(3),
    "pdfFileName" TEXT,
    "notes" TEXT,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateAccessed" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCollection" (
    "id" TEXT NOT NULL,
    "articleRefId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTag" (
    "id" TEXT NOT NULL,
    "articleRefId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfAnnotation" (
    "id" TEXT NOT NULL,
    "articleRefId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "position" JSONB NOT NULL,
    "content" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "articleRefId" TEXT,
    "libraryId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "Library_userId_idx" ON "Library"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Library_userId_name_key" ON "Library"("userId", "name");

-- CreateIndex
CREATE INDEX "Collection_libraryId_idx" ON "Collection"("libraryId");

-- CreateIndex
CREATE INDEX "Collection_parentId_idx" ON "Collection"("parentId");

-- CreateIndex
CREATE INDEX "Tag_libraryId_idx" ON "Tag"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_libraryId_name_key" ON "Tag"("libraryId", "name");

-- CreateIndex
CREATE INDEX "ArticleRef_libraryId_idx" ON "ArticleRef"("libraryId");

-- CreateIndex
CREATE INDEX "ArticleRef_pmid_idx" ON "ArticleRef"("pmid");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleRef_libraryId_pmid_key" ON "ArticleRef"("libraryId", "pmid");

-- CreateIndex
CREATE INDEX "ArticleCollection_articleRefId_idx" ON "ArticleCollection"("articleRefId");

-- CreateIndex
CREATE INDEX "ArticleCollection_collectionId_idx" ON "ArticleCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCollection_articleRefId_collectionId_key" ON "ArticleCollection"("articleRefId", "collectionId");

-- CreateIndex
CREATE INDEX "ArticleTag_articleRefId_idx" ON "ArticleTag"("articleRefId");

-- CreateIndex
CREATE INDEX "ArticleTag_tagId_idx" ON "ArticleTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTag_articleRefId_tagId_key" ON "ArticleTag"("articleRefId", "tagId");

-- CreateIndex
CREATE INDEX "PdfAnnotation_articleRefId_idx" ON "PdfAnnotation"("articleRefId");

-- CreateIndex
CREATE INDEX "PdfAnnotation_userId_idx" ON "PdfAnnotation"("userId");

-- CreateIndex
CREATE INDEX "Note_libraryId_idx" ON "Note"("libraryId");

-- CreateIndex
CREATE INDEX "Note_articleRefId_idx" ON "Note"("articleRefId");

-- CreateIndex
CREATE INDEX "Note_parentId_idx" ON "Note"("parentId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRef" ADD CONSTRAINT "ArticleRef_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRef" ADD CONSTRAINT "ArticleRef_pmid_fkey" FOREIGN KEY ("pmid") REFERENCES "Article"("pmid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCollection" ADD CONSTRAINT "ArticleCollection_articleRefId_fkey" FOREIGN KEY ("articleRefId") REFERENCES "ArticleRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCollection" ADD CONSTRAINT "ArticleCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_articleRefId_fkey" FOREIGN KEY ("articleRefId") REFERENCES "ArticleRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfAnnotation" ADD CONSTRAINT "PdfAnnotation_articleRefId_fkey" FOREIGN KEY ("articleRefId") REFERENCES "ArticleRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_articleRefId_fkey" FOREIGN KEY ("articleRefId") REFERENCES "ArticleRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;
