-- Clean up leftover tables/columns from a rolled-back feature branch that were applied
-- directly to this database (migrations never committed to staging/main). Both tables
-- are dev-only test data (SiteTransaction: 0 rows, BalanceAdjustment: 1 test row).

-- DropForeignKey
ALTER TABLE "BalanceAdjustment" DROP CONSTRAINT "BalanceAdjustment_performedById_fkey";

-- DropForeignKey
ALTER TABLE "BalanceAdjustment" DROP CONSTRAINT "BalanceAdjustment_siteId_fkey";

-- DropForeignKey
ALTER TABLE "BalanceAdjustment" DROP CONSTRAINT "BalanceAdjustment_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "SiteTransaction" DROP CONSTRAINT "SiteTransaction_billId_fkey";

-- DropForeignKey
ALTER TABLE "SiteTransaction" DROP CONSTRAINT "SiteTransaction_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "SiteTransaction" DROP CONSTRAINT "SiteTransaction_performedById_fkey";

-- DropForeignKey
ALTER TABLE "SiteTransaction" DROP CONSTRAINT "SiteTransaction_reversesId_fkey";

-- DropForeignKey
ALTER TABLE "SiteTransaction" DROP CONSTRAINT "SiteTransaction_siteId_fkey";

-- AlterTable
ALTER TABLE "Site" DROP COLUMN "openingBalance";

-- DropTable
DROP TABLE "BalanceAdjustment";

-- DropTable
DROP TABLE "SiteTransaction";

-- DropEnum
DROP TYPE "BalanceAdjustmentEntity";

-- DropEnum
DROP TYPE "SiteTxnType";

-- Vendor.openingBalance already exists in this database (added by the first, never-
-- rolled-back-at-DB-level migration from earlier this session) -- no ADD COLUMN needed.
