/*
  Warnings:

  - The primary key for the `GuildConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `GuildConfig` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `GuildConfig` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `GuildConfig` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "answers" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "moderatorId" TEXT,
    "reason" TEXT,
    "messageId" TEXT
);
INSERT INTO "new_Application" ("answers", "createdAt", "decidedAt", "guildId", "id", "messageId", "moderatorId", "reason", "status", "userId") SELECT "answers", "createdAt", "decidedAt", "guildId", "id", "messageId", "moderatorId", "reason", "status", "userId" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE UNIQUE INDEX "Application_userId_guildId_key" ON "Application"("userId", "guildId");
CREATE TABLE "new_GuildConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "recruitChannelId" TEXT,
    "staffChannelId" TEXT,
    "staffRoleId" TEXT,
    "panelTitle" TEXT,
    "panelDesc" TEXT,
    "panelImage" TEXT,
    "panelThumb" TEXT,
    "panelAccent" TEXT,
    "classOptions" TEXT,
    "formQuestions" TEXT
);
INSERT INTO "new_GuildConfig" ("guildId", "id", "panelAccent", "panelDesc", "panelImage", "panelThumb", "panelTitle", "recruitChannelId", "staffChannelId", "staffRoleId") SELECT "guildId", "id", "panelAccent", "panelDesc", "panelImage", "panelThumb", "panelTitle", "recruitChannelId", "staffChannelId", "staffRoleId" FROM "GuildConfig";
DROP TABLE "GuildConfig";
ALTER TABLE "new_GuildConfig" RENAME TO "GuildConfig";
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
