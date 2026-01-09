/*
  Warnings:

  - You are about to drop the column `userXPLevel` on the `AuctionBid` table. All the data in the column will be lost.
  - You are about to drop the column `zkCost` on the `AuctionItem` table. All the data in the column will be lost.
  - You are about to drop the `ZKEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ZKEventRSVP` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `amount` to the `AuctionBid` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ZKEventRSVP" DROP CONSTRAINT "ZKEventRSVP_eventId_fkey";

-- DropIndex
DROP INDEX "AuctionBid_itemId_userId_key";

-- DropIndex
DROP INDEX "AuctionBid_itemId_userXPLevel_idx";

-- AlterTable
ALTER TABLE "AuctionBid" DROP COLUMN "userXPLevel",
ADD COLUMN     "amount" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "AuctionItem" DROP COLUMN "zkCost",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "minIncrement" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "startingPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "announcementChannelId" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "recurrence" TEXT,
ADD COLUMN     "recurrenceDay" INTEGER,
ADD COLUMN     "voiceChannelId" TEXT,
ADD COLUMN     "zkReward" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "ZKEvent";

-- DropTable
DROP TABLE "ZKEventRSVP";

-- CreateTable
CREATE TABLE "UserZK" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserZK_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateTable
CREATE TABLE "ZKTransaction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZKTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomySettings" (
    "guildId" TEXT NOT NULL,
    "currencyName" TEXT NOT NULL DEFAULT 'Coins',
    "currencyEmoji" TEXT NOT NULL DEFAULT '🪙',
    "eventDefaultReward" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomySettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateIndex
CREATE INDEX "ZKTransaction_guildId_userId_idx" ON "ZKTransaction"("guildId", "userId");

-- CreateIndex
CREATE INDEX "AuctionBid_itemId_amount_idx" ON "AuctionBid"("itemId", "amount");
