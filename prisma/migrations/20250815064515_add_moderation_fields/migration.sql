/*
  Warnings:

  - You are about to drop the column `moderatorUserId` on the `Application` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Application" DROP COLUMN "moderatorUserId",
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedByDisplay" TEXT,
ADD COLUMN     "moderatedById" TEXT;
