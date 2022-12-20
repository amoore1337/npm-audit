/*
  Warnings:

  - You are about to drop the column `homepage` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `repo` on the `Package` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Package" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "latestVersion" TEXT NOT NULL,
    "versions" TEXT NOT NULL,
    "npmPage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Package" ("createdAt", "id", "latestVersion", "name", "updatedAt", "versions") SELECT "createdAt", "id", "latestVersion", "name", "updatedAt", "versions" FROM "Package";
DROP TABLE "Package";
ALTER TABLE "new_Package" RENAME TO "Package";
CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
