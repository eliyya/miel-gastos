CREATE TABLE "EasystoreWebhookSettings" (
    "id" TEXT NOT NULL DEFAULT 'easystore',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secretEncrypted" TEXT,
    "secretUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EasystoreWebhookSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EasystoreWebhookSettings_singleton" CHECK ("id" = 'easystore'),
    CONSTRAINT "EasystoreWebhookSettings_secret" CHECK (
        ("secretEncrypted" IS NULL) = ("secretUpdatedAt" IS NULL)
        AND (NOT "enabled" OR "secretEncrypted" IS NOT NULL)
    )
);
