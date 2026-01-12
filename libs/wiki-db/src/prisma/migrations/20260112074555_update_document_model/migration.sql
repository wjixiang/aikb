/*
  Warnings:

  - You are about to drop the column `outlinePath` on the `document` table. All the data in the column will be lost.
  - Added the required column `topic` to the `document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topic` to the `record` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "document" DROP COLUMN "outlinePath",
ADD COLUMN     "topic" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "record" ADD COLUMN     "topic" TEXT NOT NULL;
