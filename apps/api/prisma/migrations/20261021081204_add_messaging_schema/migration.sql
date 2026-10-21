-- CreateEnum
CREATE TYPE "channel" AS ENUM ('ZALO', 'FACEBOOK', 'TIKTOK', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "channel_accounts" (
    "id" UUID NOT NULL,
    "channel" "channel" NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "channel_account_id" UUID NOT NULL,
    "channel" "channel" NOT NULL,
    "direction" "message_direction" NOT NULL,
    "content" TEXT,
    "sent_at" TIMESTAMPTZ(3) NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_accounts_channel_external_account_id_key" ON "channel_accounts"("channel", "external_account_id");

-- CreateIndex
CREATE INDEX "messages_channel_account_id_sent_at_idx" ON "messages"("channel_account_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_channel_external_message_id_key" ON "messages"("channel", "external_message_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_account_id_fkey" FOREIGN KEY ("channel_account_id") REFERENCES "channel_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
