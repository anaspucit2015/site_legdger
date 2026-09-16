-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;
