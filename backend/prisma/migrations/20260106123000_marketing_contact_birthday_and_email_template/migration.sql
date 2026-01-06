-- DB catch-up for production:
-- Adds MarketingContact.anniversaryDate + birthdayDate
-- Creates MarketingEmailTemplate + MarketingEmailTemplateVersion (+ indexes/FKs)
-- Source: /tmp/prisma-db-catchup.sql (generated via prisma migrate diff)

-- 1) Add missing columns to MarketingContact (idempotent)
ALTER TABLE "MarketingContact"
  ADD COLUMN IF NOT EXISTS "anniversaryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "birthdayDate" TIMESTAMP(3);

-- 2) MarketingEmailTemplate (create if missing)
DO $$
BEGIN
  IF to_regclass('public."MarketingEmailTemplate"') IS NULL THEN
    CREATE TABLE "MarketingEmailTemplate" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "showId" TEXT,
      "currentVersionId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MarketingEmailTemplate_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- Ensure any missing columns exist (extra safety)
ALTER TABLE "MarketingEmailTemplate"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "subject" TEXT,
  ADD COLUMN IF NOT EXISTS "showId" TEXT,
  ADD COLUMN IF NOT EXISTS "currentVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- 3) MarketingEmailTemplateVersion (create if missing)
DO $$
BEGIN
  IF to_regclass('public."MarketingEmailTemplateVersion"') IS NULL THEN
    CREATE TABLE "MarketingEmailTemplateVersion" (
      "id" TEXT NOT NULL,
      "templateId" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "document" JSONB NOT NULL,
      "html" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MarketingEmailTemplateVersion_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- Ensure any missing columns exist (extra safety)
ALTER TABLE "MarketingEmailTemplateVersion"
  ADD COLUMN IF NOT EXISTS "templateId" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER,
  ADD COLUMN IF NOT EXISTS "document" JSONB,
  ADD COLUMN IF NOT EXISTS "html" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

-- 4) Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "MarketingEmailTemplate_tenantId_idx"
  ON "MarketingEmailTemplate" ("tenantId");

CREATE INDEX IF NOT EXISTS "MarketingEmailTemplateVersion_templateId_idx"
  ON "MarketingEmailTemplateVersion" ("templateId");

-- 5) Foreign keys (idempotent)
DO $$
BEGIN
  ALTER TABLE "MarketingEmailTemplate"
    ADD CONSTRAINT "MarketingEmailTemplate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MarketingEmailTemplateVersion"
    ADD CONSTRAINT "MarketingEmailTemplateVersion_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "MarketingEmailTemplate"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
