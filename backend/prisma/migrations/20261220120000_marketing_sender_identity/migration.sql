-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MarketingSenderMode" AS ENUM ('SENDGRID', 'SMTP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MarketingVerifiedStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns (safe if re-run)
ALTER TABLE "MarketingSettings"
  ADD COLUMN IF NOT EXISTS "sendingMode" "MarketingSenderMode" NOT NULL DEFAULT 'SENDGRID',
  ADD COLUMN IF NOT EXISTS "verifiedStatus" "MarketingVerifiedStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "sendgridDomainId" TEXT,
  ADD COLUMN IF NOT EXISTS "sendgridDomain" TEXT,
  ADD COLUMN IF NOT EXISTS "sendgridSubdomain" TEXT,
  ADD COLUMN IF NOT EXISTS "sendgridDnsRecords" JSONB,
  ADD COLUMN IF NOT EXISTS "smtpHost" TEXT,
  ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER,
  ADD COLUMN IF NOT EXISTS "smtpUserEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "smtpPassEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "smtpLastTestAt" TIMESTAMP(3);
