-- CreateTable
CREATE TABLE "VoiceActivity" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceActivity_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateIndex
CREATE INDEX "VoiceActivity_guildId_totalSeconds_idx" ON "VoiceActivity"("guildId", "totalSeconds");
