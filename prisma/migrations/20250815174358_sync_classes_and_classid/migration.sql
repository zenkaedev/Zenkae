/*
  Warnings:

  - You are about to drop the column `moderatedByDisplay` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `moderatedById` on the `Application` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Application" DROP COLUMN "moderatedByDisplay",
DROP COLUMN "moderatedById",
ADD COLUMN     "classId" TEXT;

-- AlterTable
ALTER TABLE "RecruitSettings" ADD COLUMN     "appearanceAccent" INTEGER,
ADD COLUMN     "appearanceThumbUrl" TEXT,
ADD COLUMN     "classes" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "defaultApprovedRoleId" TEXT;
