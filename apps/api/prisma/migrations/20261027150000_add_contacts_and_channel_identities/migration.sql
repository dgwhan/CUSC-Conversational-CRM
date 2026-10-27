-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "phone_normalized" VARCHAR(50),
    "email" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_identities" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" "channel" NOT NULL,
    "external_user_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "channel_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_phone_normalized_key" ON "contacts"("phone_normalized");

-- CreateIndex
CREATE INDEX "channel_identities_contact_id_idx" ON "channel_identities"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_identities_channel_external_user_id_key" ON "channel_identities"("channel", "external_user_id");

-- AddForeignKey
ALTER TABLE "channel_identities" ADD CONSTRAINT "channel_identities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
