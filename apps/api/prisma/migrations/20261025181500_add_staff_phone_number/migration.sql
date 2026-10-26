-- AlterTable
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_phone_number_key" ON "staff"("phone_number");
