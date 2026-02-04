/*
  Warnings:

  - You are about to drop the column `country` on the `medline_journal_info` table. All the data in the column will be lost.
  - You are about to drop the column `issnLinking` on the `medline_journal_info` table. All the data in the column will be lost.
  - You are about to drop the column `medlineTA` on the `medline_journal_info` table. All the data in the column will be lost.
  - You are about to drop the column `nlmUniqueId` on the `medline_journal_info` table. All the data in the column will be lost.
  - Added the required column `journalId` to the `medline_journal_info` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "medline_journal_info" DROP COLUMN "country",
DROP COLUMN "issnLinking",
DROP COLUMN "medlineTA",
DROP COLUMN "nlmUniqueId",
ADD COLUMN     "journalId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Journal" (
    "id" SERIAL NOT NULL,
    "country" TEXT,
    "medlineTA" TEXT NOT NULL,
    "nlmUniqueId" INTEGER NOT NULL,
    "issnLinking" TEXT,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "medline_journal_info" ADD CONSTRAINT "medline_journal_info_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
