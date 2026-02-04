/*
  Warnings:

  - A unique constraint covering the columns `[nlmUniqueId]` on the table `Journal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Journal_nlmUniqueId_key" ON "Journal"("nlmUniqueId");
