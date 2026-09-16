/*
  Warnings:

  - A unique constraint covering the columns `[siteCode]` on the table `Site` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "siteCode" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Site_siteCode_key" ON "Site"("siteCode");
