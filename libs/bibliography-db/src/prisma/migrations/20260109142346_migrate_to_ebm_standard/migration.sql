/*
  Warnings:

  - You are about to drop the `markdowns` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `evidence_type` to the `items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "markdowns" DROP CONSTRAINT "markdowns_item_id_fkey";

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "evidence_type" TEXT NOT NULL;

-- DropTable
DROP TABLE "markdowns";
