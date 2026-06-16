-- CreateTable
CREATE TABLE "ShoppingListCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetDate" DATETIME NOT NULL,
    "itemKey" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" DATETIME,
    "checkedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShoppingListCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingListCheck_targetDate_itemKey_key" ON "ShoppingListCheck"("targetDate", "itemKey");

-- CreateIndex
CREATE INDEX "ShoppingListCheck_checked_idx" ON "ShoppingListCheck"("checked");
