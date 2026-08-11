CREATE SEQUENCE "Invoice_invoiceNumber_seq";

ALTER TABLE "Invoice"
  ADD COLUMN "invoiceNumber" INTEGER NOT NULL DEFAULT nextval('"Invoice_invoiceNumber_seq"');

ALTER SEQUENCE "Invoice_invoiceNumber_seq" OWNED BY "Invoice"."invoiceNumber";

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_invoiceNumber_key" UNIQUE ("invoiceNumber");
