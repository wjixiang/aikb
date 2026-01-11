/*
  Warnings:

  - You are about to drop the column `description` on the `entities` table. All the data in the column will be lost.
  - Added the required column `definition` to the `entities` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "entities_description_idx";

-- AlterTable
ALTER TABLE "entities" DROP COLUMN "description",
ADD COLUMN     "definition" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "entities_definition_idx" ON "entities"("definition");
