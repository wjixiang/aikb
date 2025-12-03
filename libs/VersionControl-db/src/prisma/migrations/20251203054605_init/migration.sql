-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "currentBranch" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headCommitId" TEXT NOT NULL DEFAULT '',
    "baseCommitId" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_objects" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "git_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorTimestamp" TIMESTAMP(3) NOT NULL,
    "committerName" TEXT NOT NULL,
    "committerEmail" TEXT NOT NULL,
    "committerTimestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_parents" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,

    CONSTRAINT "commit_parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_commits" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,

    CONSTRAINT "branch_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changes" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "diff" JSONB,
    "commitId" TEXT NOT NULL,

    CONSTRAINT "changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "references" (
    "id" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_entries" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "tree_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_results" (
    "id" TEXT NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "mergeCommitId" TEXT,
    "message" TEXT NOT NULL,
    "conflicts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merge_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repositories_repositoryId_key" ON "repositories"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_branchId_key" ON "branches"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_repositoryId_name_key" ON "branches"("repositoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "git_objects_objectId_key" ON "git_objects"("objectId");

-- CreateIndex
CREATE INDEX "git_objects_objectId_idx" ON "git_objects"("objectId");

-- CreateIndex
CREATE INDEX "git_objects_type_idx" ON "git_objects"("type");

-- CreateIndex
CREATE UNIQUE INDEX "commits_objectId_key" ON "commits"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "commit_parents_commitId_parentId_key" ON "commit_parents"("commitId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_commits_branchId_commitId_key" ON "branch_commits"("branchId", "commitId");

-- CreateIndex
CREATE INDEX "changes_commitId_idx" ON "changes"("commitId");

-- CreateIndex
CREATE INDEX "changes_type_idx" ON "changes"("type");

-- CreateIndex
CREATE INDEX "changes_path_idx" ON "changes"("path");

-- CreateIndex
CREATE UNIQUE INDEX "references_refId_key" ON "references"("refId");

-- CreateIndex
CREATE INDEX "references_name_idx" ON "references"("name");

-- CreateIndex
CREATE INDEX "references_type_idx" ON "references"("type");

-- CreateIndex
CREATE INDEX "tree_entries_treeId_idx" ON "tree_entries"("treeId");

-- CreateIndex
CREATE INDEX "tree_entries_name_idx" ON "tree_entries"("name");

-- CreateIndex
CREATE INDEX "merge_results_repositoryId_idx" ON "merge_results"("repositoryId");

-- CreateIndex
CREATE INDEX "merge_results_sourceBranch_targetBranch_idx" ON "merge_results"("sourceBranch", "targetBranch");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "git_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_parents" ADD CONSTRAINT "commit_parents_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_parents" ADD CONSTRAINT "commit_parents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_commits" ADD CONSTRAINT "branch_commits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_commits" ADD CONSTRAINT "branch_commits_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changes" ADD CONSTRAINT "changes_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_entries" ADD CONSTRAINT "tree_entries_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "git_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
