-- AlterTable staff: add owner_id
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "owner_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_owner_id_idx" ON "staff"("owner_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_owner_id_fkey'
    ) THEN
        ALTER TABLE "staff" ADD CONSTRAINT "staff_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable workspace_configurations
CREATE TABLE IF NOT EXISTS "workspace_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID,
    "owner_id" UUID NOT NULL,
    "domain" VARCHAR(50) NOT NULL DEFAULT 'EDUCATION',
    "workspace_name" VARCHAR(255),
    "terminology" JSONB NOT NULL DEFAULT '{}',
    "pipeline_stages" JSONB NOT NULL DEFAULT '[]',
    "product_catalog" JSONB NOT NULL DEFAULT '[]',
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_configurations_workspace_id_key" ON "workspace_configurations"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_configurations_owner_id_idx" ON "workspace_configurations"("owner_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workspace_configurations_workspace_id_fkey'
    ) THEN
        ALTER TABLE "workspace_configurations" ADD CONSTRAINT "workspace_configurations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workspace_configurations_owner_id_fkey'
    ) THEN
        ALTER TABLE "workspace_configurations" ADD CONSTRAINT "workspace_configurations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
