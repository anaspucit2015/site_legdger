-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_taskId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "customTaskName" TEXT,
ALTER COLUMN "taskId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
