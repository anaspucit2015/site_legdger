-- AlterTable
ALTER TABLE "Vendor"
  ADD COLUMN "bankName"      TEXT,
  ADD COLUMN "accountTitle"  TEXT,
  ADD COLUMN "accountNumber" TEXT,
  ADD COLUMN "iban"          TEXT,
  ADD COLUMN "branchCode"    TEXT;
