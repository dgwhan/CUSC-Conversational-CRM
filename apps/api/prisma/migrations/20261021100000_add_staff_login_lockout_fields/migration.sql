-- Add fields for tracking consecutive failed logins and temporary account locks.
ALTER TABLE "staff"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3);
