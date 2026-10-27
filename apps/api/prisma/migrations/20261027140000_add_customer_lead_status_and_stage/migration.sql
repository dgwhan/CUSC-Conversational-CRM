-- AlterTable
ALTER TABLE "customers" ADD COLUMN "lead_status" VARCHAR(50) NOT NULL DEFAULT 'NEW',
ADD COLUMN "lead_stage" VARCHAR(50);

-- CreateIndex
CREATE INDEX "customers_lead_status_idx" ON "customers"("lead_status");

-- CreateIndex
CREATE INDEX "customers_lead_stage_idx" ON "customers"("lead_stage");
