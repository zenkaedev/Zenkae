-- CreateTable
CREATE TABLE "UserLevel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLevel_guildId_xpTotal_idx" ON "UserLevel"("guildId", "xpTotal");

-- CreateIndex
CREATE INDEX "UserLevel_guildId_level_idx" ON "UserLevel"("guildId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "UserLevel_guildId_userId_key" ON "UserLevel"("guildId", "userId");
