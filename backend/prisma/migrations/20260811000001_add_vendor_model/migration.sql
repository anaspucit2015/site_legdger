-- Create Vendor table
CREATE TABLE "Vendor" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- Rename Invoice.vendorId → submittedById
ALTER TABLE "Invoice" RENAME COLUMN "vendorId" TO "submittedById";

-- Drop old FK and recreate with new name
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_vendorId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add new vendorId column (nullable — existing invoices have no vendor yet)
ALTER TABLE "Invoice" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
