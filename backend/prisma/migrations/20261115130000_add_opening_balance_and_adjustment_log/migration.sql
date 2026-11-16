-- CreateEnum
CREATE TYPE "BalanceAdjustmentEntity" AS ENUM ('SITE', 'VENDOR');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BalanceAdjustment" (
    "id" TEXT NOT NULL,
    "entityType" "BalanceAdjustmentEntity" NOT NULL,
    "siteId" TEXT,
    "vendorId" TEXT,
    "previousOpeningBalance" DECIMAL(12,2) NOT NULL,
    "newOpeningBalance" DECIMAL(12,2) NOT NULL,
    "previousCurrentBalance" DECIMAL(12,2) NOT NULL,
    "newCurrentBalance" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BalanceAdjustment" ADD CONSTRAINT "BalanceAdjustment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceAdjustment" ADD CONSTRAINT "BalanceAdjustment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceAdjustment" ADD CONSTRAINT "BalanceAdjustment_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
