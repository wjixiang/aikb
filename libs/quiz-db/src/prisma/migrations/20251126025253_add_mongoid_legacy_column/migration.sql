/*
  Warnings:

  - Added the required column `mongo_id_legacy` to the `quizzes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "mongo_id_legacy" TEXT NOT NULL;
