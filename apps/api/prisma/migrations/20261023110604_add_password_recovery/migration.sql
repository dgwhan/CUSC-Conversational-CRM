-- CreateEnum
CREATE TYPE "PasswordRecoveryChallengeStatus" AS ENUM ('INELIGIBLE', 'PENDING_SEND', 'PENDING_VERIFICATION', 'VERIFIED', 'COMPLETED', 'EXPIRED', 'LOCKED', 'SUPERSEDED', 'SEND_FAILED');

-- CreateEnum
CREATE TYPE "PasswordRecoveryDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'RETRY_WAIT', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PasswordRecoveryRateLimitScope" AS ENUM ('IP_REQUEST', 'EMAIL_REQUEST', 'EMAIL_SEND', 'IP_VERIFY', 'IP_RESET');

-- CreateTable
CREATE TABLE "password_recovery_challenges" (
    "id" UUID NOT NULL,
    "staff_id" UUID,
    "email_key" VARCHAR(64) NOT NULL,
    "status" "PasswordRecoveryChallengeStatus" NOT NULL DEFAULT 'PENDING_SEND',
    "otp_verifier" VARCHAR(64),
    "expires_at" TIMESTAMPTZ(6),
    "reset_token_hash" VARCHAR(64),
    "reset_token_expires_at" TIMESTAMPTZ(6),
    "failed_attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_successful_send_at" TIMESTAMPTZ(6),
    "email_key_version" SMALLINT NOT NULL,
    "otp_key_version" SMALLINT,
    "verified_at" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_recovery_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_recovery_deliveries" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" "PasswordRecoveryDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "otp_verifier" VARCHAR(64) NOT NULL,
    "otp_ciphertext" BYTEA,
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "lease_owner" VARCHAR(128),
    "lease_until" TIMESTAMPTZ(6),
    "fencing_generation" BIGINT NOT NULL DEFAULT 0,
    "otp_key_version" SMALLINT NOT NULL,
    "ciphertext_key_version" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "password_recovery_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_recovery_rate_limit_buckets" (
    "id" UUID NOT NULL,
    "scope" "PasswordRecoveryRateLimitScope" NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_recovery_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_recovery_challenges_email_key_idx" ON "password_recovery_challenges"("email_key");

-- CreateIndex
CREATE INDEX "password_recovery_challenges_email_key_status_idx" ON "password_recovery_challenges"("email_key", "status");

-- CreateIndex
CREATE INDEX "password_recovery_challenges_reset_token_hash_idx" ON "password_recovery_challenges"("reset_token_hash");

-- CreateIndex
CREATE INDEX "password_recovery_challenges_status_expires_at_idx" ON "password_recovery_challenges"("status", "expires_at");

-- CreateIndex
CREATE INDEX "password_recovery_deliveries_status_next_attempt_at_idx" ON "password_recovery_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "password_recovery_deliveries_challenge_id_status_idx" ON "password_recovery_deliveries"("challenge_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "password_recovery_deliveries_challenge_id_generation_key" ON "password_recovery_deliveries"("challenge_id", "generation");

-- CreateIndex
CREATE INDEX "password_recovery_rate_limit_buckets_expires_at_idx" ON "password_recovery_rate_limit_buckets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_recovery_rate_limit_buckets_scope_key_hash_window__key" ON "password_recovery_rate_limit_buckets"("scope", "key_hash", "window_start");

-- AddForeignKey
ALTER TABLE "password_recovery_challenges" ADD CONSTRAINT "password_recovery_challenges_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_recovery_deliveries" ADD CONSTRAINT "password_recovery_deliveries_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "password_recovery_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
