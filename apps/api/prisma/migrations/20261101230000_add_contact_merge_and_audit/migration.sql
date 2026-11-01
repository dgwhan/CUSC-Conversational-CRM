-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONTACT_MERGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONTACT_UNMERGED';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "is_merged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "merged_into_contact_id" UUID;

-- CreateTable
CREATE TABLE IF NOT EXISTS "contact_merge_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_contact_id" UUID NOT NULL,
    "source_contact_id" UUID NOT NULL,
    "phone_normalized" VARCHAR(50) NOT NULL,
    "merge_type" VARCHAR(50) NOT NULL DEFAULT 'AUTO_PHONE_MATCH',
    "actor_id" UUID,
    "snapshot_data" JSONB NOT NULL,
    "is_reverted" BOOLEAN NOT NULL DEFAULT false,
    "reverted_at" TIMESTAMPTZ(3),
    "reverted_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_merge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_is_merged_idx" ON "contacts"("is_merged");
CREATE INDEX IF NOT EXISTS "contacts_merged_into_contact_id_idx" ON "contacts"("merged_into_contact_id");
CREATE INDEX IF NOT EXISTS "contact_merge_logs_target_contact_id_idx" ON "contact_merge_logs"("target_contact_id");
CREATE INDEX IF NOT EXISTS "contact_merge_logs_source_contact_id_idx" ON "contact_merge_logs"("source_contact_id");
CREATE INDEX IF NOT EXISTS "contact_merge_logs_phone_normalized_idx" ON "contact_merge_logs"("phone_normalized");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_merge_logs_target_contact_id_fkey') THEN
        ALTER TABLE "contact_merge_logs" ADD CONSTRAINT "contact_merge_logs_target_contact_id_fkey" FOREIGN KEY ("target_contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

