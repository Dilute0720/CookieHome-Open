PRAGMA foreign_keys=OFF;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- Backfill existing users with stable account names.
UPDATE "User" SET "username" = 'me' WHERE "email" = 'me@example.com';
UPDATE "User" SET "username" = 'sister' WHERE "email" = 'sister@example.com';
UPDATE "User" SET "username" = 'yuyuan' WHERE "email" = 'girlfriend@example.com';
UPDATE "User" SET "username" = lower(replace(substr("email", 1, instr("email", '@') - 1), ' ', '-')) WHERE "username" IS NULL OR "username" = '';

-- Rebuild User so username can be required in SQLite.
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FAMILY',
    "avatar" TEXT,
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_User" ("id", "name", "username", "email", "role", "avatar", "passwordHash", "createdAt", "updatedAt")
SELECT "id", "name", "username", "email", "role", "avatar", "passwordHash", "createdAt", "updatedAt" FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Rebuild TomorrowMenu so the cook relation is represented in SQLite.
CREATE TABLE "new_TomorrowMenu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cookedById" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TomorrowMenu_cookedById_fkey" FOREIGN KEY ("cookedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_TomorrowMenu" ("id", "targetDate", "status", "createdAt", "updatedAt")
SELECT "id", "targetDate", "status", "createdAt", "updatedAt" FROM "TomorrowMenu";

DROP TABLE "TomorrowMenu";
ALTER TABLE "new_TomorrowMenu" RENAME TO "TomorrowMenu";
CREATE UNIQUE INDEX "TomorrowMenu_targetDate_key" ON "TomorrowMenu"("targetDate");

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'MESSAGE';

PRAGMA foreign_keys=ON;
