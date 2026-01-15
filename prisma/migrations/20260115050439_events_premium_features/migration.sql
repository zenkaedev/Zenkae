-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "publishAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "rsvpLockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventSettings" (
    "guildId" TEXT NOT NULL,
    "publicationChannelId" TEXT,
    "announcementChannelId" TEXT,
    "defaultDmMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSettings_pkey" PRIMARY KEY ("guildId")
);
