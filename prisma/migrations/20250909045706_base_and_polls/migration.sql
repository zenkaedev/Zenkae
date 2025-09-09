/*
  Warnings:

  - Made the column `qAnswers` on table `Application` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Application" ALTER COLUMN "qAnswers" SET NOT NULL,
ALTER COLUMN "qAnswers" SET DEFAULT '[]';

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "question" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "multi" BOOLEAN NOT NULL DEFAULT false,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIdx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Poll_guildId_createdAt_idx" ON "Poll"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "Poll_guildId_endsAt_idx" ON "Poll"("guildId", "endsAt");

-- CreateIndex
CREATE INDEX "PollVote_pollId_optionIdx_idx" ON "PollVote"("pollId", "optionIdx");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_userId_optionIdx_key" ON "PollVote"("pollId", "userId", "optionIdx");

-- CreateIndex
CREATE INDEX "Application_guildId_status_createdAt_idx" ON "Application"("guildId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
