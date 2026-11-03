-- Migration: 20261102120000_unify_customer_and_dual_taxonomy
-- Purpose: Unify Contact & Customer into Customer Master Entity, establish real ChannelIdentity relation, and remove runtime DDL dependency.

-- 1. Ensure extensions and enum values
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_MERGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_UNMERGED';

-- 2. Alter customers table
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone_normalized" VARCHAR(50);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_merged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "merged_into_customer_id" UUID;

CREATE INDEX IF NOT EXISTS "customers_phone_normalized_idx" ON "customers"("phone_normalized");
CREATE INDEX IF NOT EXISTS "customers_is_merged_idx" ON "customers"("is_merged");
CREATE INDEX IF NOT EXISTS "customers_merged_into_customer_id_idx" ON "customers"("merged_into_customer_id");

-- 3. Alter channel_identities table to support customer_id
ALTER TABLE "channel_identities" ALTER COLUMN "contact_id" DROP NOT NULL;
ALTER TABLE "channel_identities" ADD COLUMN IF NOT EXISTS "customer_id" UUID;

CREATE INDEX IF NOT EXISTS "channel_identities_customer_id_idx" ON "channel_identities"("customer_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'channel_identities_customer_id_fkey'
    ) THEN
        ALTER TABLE "channel_identities"
        ADD CONSTRAINT "channel_identities_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Create customer_merge_logs table
CREATE TABLE IF NOT EXISTS "customer_merge_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "target_customer_id" UUID NOT NULL,
    "source_customer_id" UUID NOT NULL,
    "phone_normalized" VARCHAR(50) NOT NULL,
    "merge_type" VARCHAR(50) NOT NULL DEFAULT 'AUTO_PHONE_MATCH',
    "actor_id" UUID,
    "snapshot_data" JSONB NOT NULL,
    "is_reverted" BOOLEAN NOT NULL DEFAULT false,
    "reverted_at" TIMESTAMPTZ(3),
    "reverted_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_merge_logs_target_customer_id_fkey"
        FOREIGN KEY ("target_customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_merge_logs_target_customer_id_idx" ON "customer_merge_logs"("target_customer_id");
CREATE INDEX IF NOT EXISTS "customer_merge_logs_source_customer_id_idx" ON "customer_merge_logs"("source_customer_id");
CREATE INDEX IF NOT EXISTS "customer_merge_logs_phone_normalized_idx" ON "customer_merge_logs"("phone_normalized");

-- 5. Data Migration / Backfill to link customers and channel identities safely
UPDATE "channel_identities" ci
SET "customer_id" = ci."contact_id"
WHERE ci."customer_id" IS NULL
  AND ci."contact_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "customers" c WHERE c."id" = ci."contact_id");

-- Extract identities stored in JSONB channel_identities to real rows in channel_identities for ZALO
INSERT INTO "channel_identities" ("id", "customer_id", "channel", "external_user_id", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    c."id",
    'ZALO'::"channel",
    COALESCE(c."channel_identities"->'zalo'->>'id', c."channel_identities"->>'zalo', c."channel_identities"->>'socialId'),
    NOW(),
    NOW()
FROM "customers" c
WHERE c."channel_identities" IS NOT NULL
  AND COALESCE(c."channel_identities"->'zalo'->>'id', c."channel_identities"->>'zalo', c."channel_identities"->>'socialId') IS NOT NULL
  AND COALESCE(c."channel_identities"->'zalo'->>'id', c."channel_identities"->>'zalo', c."channel_identities"->>'socialId') != ''
ON CONFLICT ("channel", "external_user_id") DO UPDATE
SET "customer_id" = EXCLUDED."customer_id", "updated_at" = NOW();

-- Extract identities stored in JSONB channel_identities to real rows in channel_identities for FACEBOOK
INSERT INTO "channel_identities" ("id", "customer_id", "channel", "external_user_id", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    c."id",
    'FACEBOOK'::"channel",
    c."channel_identities"->>'facebook',
    NOW(),
    NOW()
FROM "customers" c
WHERE c."channel_identities" IS NOT NULL
  AND c."channel_identities"->>'facebook' IS NOT NULL
  AND c."channel_identities"->>'facebook' != ''
ON CONFLICT ("channel", "external_user_id") DO UPDATE
SET "customer_id" = EXCLUDED."customer_id", "updated_at" = NOW();

-- Normalize existing customer phones
UPDATE "customers"
SET "phone_normalized" = regexp_replace("phone", '[^0-9]', '', 'g')
WHERE "phone" IS NOT NULL
  AND "phone" != 'Chưa có SĐT'
  AND regexp_replace("phone", '[^0-9]', '', 'g') != ''
  AND "phone_normalized" IS NULL;
