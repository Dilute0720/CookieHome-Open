-- CreateTable
CREATE TABLE "CookingJournal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dishId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CookingJournal_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
