-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'LOCKED');

-- RenameTable staff to users
ALTER TABLE "staff" RENAME TO "users";

-- AlterTable users
DROP INDEX IF EXISTS "staff_owner_id_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "owner_id";

ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "user_status" USING "status"::text::"user_status";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"user_status";

ALTER TABLE "users" RENAME CONSTRAINT "staff_pkey" TO "users_pkey";

ALTER INDEX IF EXISTS "staff_email_key" RENAME TO "users_email_key";
ALTER INDEX IF EXISTS "staff_phone_number_key" RENAME TO "users_phone_number_key";
ALTER INDEX IF EXISTS "staff_telegram_chat_id_key" RENAME TO "users_telegram_chat_id_key";

-- AlterTable refresh_tokens
ALTER TABLE "refresh_tokens" RENAME COLUMN "staff_id" TO "user_id";
ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "refresh_tokens_staff_id_fkey" TO "refresh_tokens_user_id_fkey";
ALTER INDEX IF EXISTS "refresh_tokens_staff_id_idx" RENAME TO "refresh_tokens_user_id_idx";

-- AlterTable password_recovery_challenges
ALTER TABLE "password_recovery_challenges" RENAME COLUMN "staff_id" TO "user_id";
ALTER TABLE "password_recovery_challenges" RENAME CONSTRAINT "password_recovery_challenges_staff_id_fkey" TO "password_recovery_challenges_user_id_fkey";

-- AlterTable audit_logs
ALTER TABLE "audit_logs" RENAME COLUMN "staff_id" TO "user_id";
ALTER TABLE "audit_logs" RENAME CONSTRAINT "audit_logs_staff_id_fkey" TO "audit_logs_user_id_fkey";
ALTER INDEX IF EXISTS "audit_logs_staff_id_idx" RENAME TO "audit_logs_user_id_idx";

-- AlterTable workspace_members
ALTER TABLE "workspace_members" RENAME COLUMN "staff_id" TO "user_id";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "workspace_members_staff_id_fkey" TO "workspace_members_user_id_fkey";
ALTER INDEX IF EXISTS "workspace_members_staff_id_idx" RENAME TO "workspace_members_user_id_idx";
ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "workspace_members_workspace_id_staff_id_key";
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");

-- DropEnum
DROP TYPE IF EXISTS "StaffStatus";
