-- AlterTable
ALTER TABLE "MarketingSettings" ADD COLUMN     "sendingMode" TEXT NOT NULL DEFAULT 'SENDGRID',
ADD COLUMN     "verifiedStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "sendgridDomainId" TEXT,
ADD COLUMN     "sendgridDomain" TEXT,
ADD COLUMN     "sendgridSubdomain" TEXT,
ADD COLUMN     "sendgridDnsRecords" JSONB,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpUserEncrypted" TEXT,
ADD COLUMN     "smtpPassEncrypted" TEXT,
ADD COLUMN     "smtpSecure" BOOLEAN,
ADD COLUMN     "smtpLastTestAt" TIMESTAMP(3);

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

-- Ensure enums are used for columns
ALTER TABLE "MarketingSettings" ALTER COLUMN "sendingMode" TYPE "MarketingSenderMode" USING ("sendingMode"::"MarketingSenderMode");
ALTER TABLE "MarketingSettings" ALTER COLUMN "verifiedStatus" TYPE "MarketingVerifiedStatus" USING ("verifiedStatus"::"MarketingVerifiedStatus");
