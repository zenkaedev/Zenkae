-- CreateTable
CREATE TABLE "VoiceActivityWeek" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceActivityWeek_pkey" PRIMARY KEY ("guildId","userId","weekStart")
);

-- CreateIndex
CREATE INDEX "VoiceActivityWeek_guildId_weekStart_totalSeconds_idx" ON "VoiceActivityWeek"("guildId", "weekStart", "totalSeconds");
