ALTER TABLE "OrderItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "OrderItem" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "OrderItem" ADD COLUMN "completedById" TEXT;

CREATE INDEX "OrderItem_status_idx" ON "OrderItem"("status");
CREATE INDEX "OrderItem_completedAt_idx" ON "OrderItem"("completedAt");
