-- V2 Vendor Payment System Migration
-- Safe for production: converts existing data before altering enums, never deletes records.
-- Avoids ALTER TYPE ADD VALUE + same-transaction use (Postgres restriction) by converting
-- the column to TEXT first, then recreating the enum with all values at once.

-- ─── Step 1: Data safety — convert any 'paid' invoices/bills to 'approved' ──
UPDATE "Invoice" SET "status" = 'approved' WHERE "status" = 'paid';
UPDATE "Bill"    SET "status" = 'approved' WHERE "status" = 'paid';

-- ─── Step 2: Add new PaymentMethod enum ──────────────────────────────────────
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'JAZZCASH_EASYPAISA');

-- ─── Step 3: Add new columns to VendorTransaction ────────────────────────────
ALTER TABLE "VendorTransaction" ADD COLUMN "paymentMethod"        "PaymentMethod";
ALTER TABLE "VendorTransaction" ADD COLUMN "invoiceReferenceNote" TEXT;

-- ─── Step 4: Convert type column to TEXT so we can freely migrate data ────────
ALTER TABLE "VendorTransaction" ALTER COLUMN "type" TYPE TEXT;
DROP TYPE "VendorTxnType";

-- ─── Step 5: Data migration — convert old transaction types to v2 equivalents ─
-- INVOICE_SETTLEMENT → INVOICE_APPROVED  (invoice was settled, closest v2 equivalent)
-- BILL_SETTLEMENT    → BILL_APPROVED     (same for bills)
-- BALANCE_PAYMENT    → VENDOR_PAYMENT    (direct cash payment to vendor; set method to CASH)
UPDATE "VendorTransaction" SET "type" = 'INVOICE_APPROVED'                         WHERE "type" = 'INVOICE_SETTLEMENT';
UPDATE "VendorTransaction" SET "type" = 'BILL_APPROVED'                            WHERE "type" = 'BILL_SETTLEMENT';
UPDATE "VendorTransaction" SET "type" = 'VENDOR_PAYMENT', "paymentMethod" = 'CASH' WHERE "type" = 'BALANCE_PAYMENT';

-- ─── Step 6: Recreate VendorTxnType with all v2 values ───────────────────────
CREATE TYPE "VendorTxnType" AS ENUM (
  'ADVANCE_GIVEN',
  'INVOICE_APPROVED',
  'BILL_APPROVED',
  'ADVANCE_APPLIED',
  'VENDOR_PAYMENT',
  'REVERSAL'
);

-- ─── Step 7: Restore column to the new enum type ─────────────────────────────
ALTER TABLE "VendorTransaction"
  ALTER COLUMN "type" TYPE "VendorTxnType"
  USING "type"::"VendorTxnType";

-- ─── Step 8: Drop settlementMethod columns (must happen before dropping the enum) ─
ALTER TABLE "VendorTransaction" DROP COLUMN IF EXISTS "settlementMethod";
ALTER TABLE "Invoice"           DROP COLUMN IF EXISTS "settlementMethod";
ALTER TABLE "Bill"              DROP COLUMN IF EXISTS "settlementMethod";

-- ─── Step 9: Drop SettlementMethod enum (now safe — no columns reference it) ──
DROP TYPE IF EXISTS "SettlementMethod";

-- ─── Step 10: Drop old payment columns from Invoice and Bill ──────────────────
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "paidBy";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "paidAt";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "paymentRef";
ALTER TABLE "Bill"    DROP COLUMN IF EXISTS "paidBy";
ALTER TABLE "Bill"    DROP COLUMN IF EXISTS "paidAt";
ALTER TABLE "Bill"    DROP COLUMN IF EXISTS "paymentRef";

-- ─── Step 11: Add 'voided' to InvoiceStatus, remove 'paid' ──────────────────
-- Recreate enum without 'paid' (PostgreSQL cannot drop enum values in-place)
-- Must drop DEFAULTs first — Postgres cannot auto-cast them to the new enum type
CREATE TYPE "InvoiceStatus_new" AS ENUM ('pending', 'approved', 'rejected', 'voided');
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice"
  ALTER COLUMN "status" TYPE "InvoiceStatus_new"
  USING "status"::text::"InvoiceStatus_new";
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'pending'::"InvoiceStatus_new";
ALTER TABLE "Bill" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Bill"
  ALTER COLUMN "status" TYPE "InvoiceStatus_new"
  USING "status"::text::"InvoiceStatus_new";
ALTER TABLE "Bill" ALTER COLUMN "status" SET DEFAULT 'pending'::"InvoiceStatus_new";
DROP TYPE "InvoiceStatus";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
