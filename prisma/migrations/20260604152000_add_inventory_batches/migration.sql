-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "stockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shelfLifeDays" INTEGER,
    "expiresAt" DATETIME,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Inventory" ("id", "name", "quantity", "unit", "stockedAt", "updatedAt")
SELECT "id", "name", "quantity", "unit", COALESCE("updatedAt", CURRENT_TIMESTAMP), "updatedAt" FROM "Inventory";

DROP TABLE "Inventory";
ALTER TABLE "new_Inventory" RENAME TO "Inventory";

CREATE INDEX "Inventory_name_unit_idx" ON "Inventory"("name", "unit");
CREATE INDEX "Inventory_expiresAt_idx" ON "Inventory"("expiresAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
