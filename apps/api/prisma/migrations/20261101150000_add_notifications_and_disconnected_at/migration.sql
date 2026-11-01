-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('CHANNEL_EXPIRING', 'CHANNEL_EXPIRED', 'NEW_LEAD', 'SYSTEM_WARNING', 'CONVERSATION_ALERT');

-- CreateEnum
CREATE TYPE "notification_severity" AS ENUM ('INFO', 'WARNING', 'URGENT', 'CRITICAL');

-- AlterTable
ALTER TABLE "channel_accounts" ADD COLUMN "disconnected_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "severity" "notification_severity" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_workspace_id_is_read_created_at_idx" ON "notifications"("workspace_id", "is_read", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
