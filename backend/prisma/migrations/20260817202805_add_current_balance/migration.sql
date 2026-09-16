-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "currentBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "currentBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;
