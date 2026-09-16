-- CreateEnum
CREATE TYPE "SettlementMethod" AS ENUM ('CASH', 'ADVANCE', 'BALANCE');

-- CreateEnum
CREATE TYPE "VendorTxnType" AS ENUM ('ADVANCE_GIVEN', 'INVOICE_SETTLEMENT', 'BILL_SETTLEMENT', 'BALANCE_PAYMENT', 'REVERSAL');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "settlementMethod" "SettlementMethod";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "settlementMethod" "SettlementMethod";

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "advanceBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VendorTransaction" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "VendorTxnType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "settlementMethod" "SettlementMethod",
    "invoiceId" TEXT,
    "billId" TEXT,
    "reversesId" TEXT,
    "outstandingAfter" DECIMAL(12,2) NOT NULL,
    "advanceAfter" DECIMAL(12,2) NOT NULL,
    "paymentRef" TEXT,
    "notes" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VendorTransaction" ADD CONSTRAINT "VendorTransaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTransaction" ADD CONSTRAINT "VendorTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTransaction" ADD CONSTRAINT "VendorTransaction_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTransaction" ADD CONSTRAINT "VendorTransaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTransaction" ADD CONSTRAINT "VendorTransaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "VendorTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
