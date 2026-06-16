-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN "sourceBlogPostId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEvent_sourceBlogPostId_key" ON "TimelineEvent"("sourceBlogPostId");
