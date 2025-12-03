-- DropForeignKey
ALTER TABLE "commits" DROP CONSTRAINT "commits_objectId_fkey";

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "git_objects"("objectId") ON DELETE CASCADE ON UPDATE CASCADE;
