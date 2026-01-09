-- CreateTable
CREATE TABLE "RankSettings" (
    "guildId" TEXT NOT NULL,
    "weeklyRoleId" TEXT,
    "monthlyRoleId" TEXT,
    "lastWeeklyRotation" TIMESTAMP(3),
    "lastMonthlyRotation" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "UserXPPeriod" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserXPPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZKEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "voiceChannelId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "dmMessage" TEXT NOT NULL,
    "zkReward" INTEGER NOT NULL DEFAULT 10,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "announcementMessageId" TEXT,
    "announcementChannelId" TEXT,
    "finalListMessageId" TEXT,
    "rsvpLocked" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ZKEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZKEventRSVP" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZKEventRSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionItem" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "zkCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userXPLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserXPPeriod_guildId_periodType_startDate_xp_idx" ON "UserXPPeriod"("guildId", "periodType", "startDate", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "UserXPPeriod_guildId_userId_periodType_startDate_key" ON "UserXPPeriod"("guildId", "userId", "periodType", "startDate");

-- CreateIndex
CREATE INDEX "ZKEvent_guildId_eventDate_idx" ON "ZKEvent"("guildId", "eventDate");

-- CreateIndex
CREATE INDEX "ZKEvent_guildId_completed_idx" ON "ZKEvent"("guildId", "completed");

-- CreateIndex
CREATE INDEX "ZKEventRSVP_eventId_response_idx" ON "ZKEventRSVP"("eventId", "response");

-- CreateIndex
CREATE UNIQUE INDEX "ZKEventRSVP_eventId_userId_key" ON "ZKEventRSVP"("eventId", "userId");

-- CreateIndex
CREATE INDEX "AuctionItem_guildId_idx" ON "AuctionItem"("guildId");

-- CreateIndex
CREATE INDEX "AuctionBid_itemId_userXPLevel_idx" ON "AuctionBid"("itemId", "userXPLevel");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionBid_itemId_userId_key" ON "AuctionBid"("itemId", "userId");

-- AddForeignKey
ALTER TABLE "ZKEventRSVP" ADD CONSTRAINT "ZKEventRSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ZKEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AuctionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
