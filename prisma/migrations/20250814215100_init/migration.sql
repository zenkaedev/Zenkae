-- CreateTable
CREATE TABLE "RecruitSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "panelChannelId" TEXT,
    "formsChannelId" TEXT,
    "appearanceTitle" TEXT,
    "appearanceDescription" TEXT,
    "appearanceImageUrl" TEXT,
    "questions" TEXT NOT NULL DEFAULT '[]',
    "dmAcceptedTemplate" TEXT NOT NULL DEFAULT 'Parabéns! Você foi aprovado 🎉',
    "dmRejectedTemplate" TEXT NOT NULL DEFAULT 'Obrigado por se inscrever. Infelizmente sua candidatura foi recusada. Motivo: {reason}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MessageCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nick" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "qAnswers" TEXT,
    "reason" TEXT,
    "messageId" TEXT,
    "channelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Application" ("className", "createdAt", "guildId", "id", "nick", "status", "updatedAt", "userId", "username") SELECT "className", "createdAt", "guildId", "id", "nick", "status", "updatedAt", "userId", "username" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE INDEX "Application_guildId_userId_idx" ON "Application"("guildId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MessageCounter_guildId_userId_key" ON "MessageCounter"("guildId", "userId");
