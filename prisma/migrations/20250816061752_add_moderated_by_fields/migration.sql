/*
  Warnings:

  - You are about to drop the column `moderatorId` on the `Application` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Application" DROP COLUMN "moderatorId",
ADD COLUMN     "moderatedByDisplay" TEXT,
ADD COLUMN     "moderatedById" TEXT;
