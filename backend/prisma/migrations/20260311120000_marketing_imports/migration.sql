-- AlterEnum
ALTER TYPE "MarketingConsentSource" ADD VALUE 'NEWSLETTER_SIGNUP';
ALTER TYPE "MarketingConsentSource" ADD VALUE 'IMPORT_CSV';

-- AlterEnum
ALTER TYPE "MarketingLawfulBasis" ADD VALUE 'CONSENT';
ALTER TYPE "MarketingLawfulBasis" ADD VALUE 'LEGITIMATE_INTEREST';

-- CreateEnum
CREATE TYPE "MarketingImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "MarketingImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT,
    "status" "MarketingImportJobStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" JSONB,

    CONSTRAINT "MarketingImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingImportRowError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "email" TEXT,
    "error" TEXT NOT NULL,

    CONSTRAINT "MarketingImportRowError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingImportJob_tenantId_idx" ON "MarketingImportJob"("tenantId");

-- CreateIndex
CREATE INDEX "MarketingImportRowError_jobId_idx" ON "MarketingImportRowError"("jobId");

-- AddForeignKey
ALTER TABLE "MarketingImportJob" ADD CONSTRAINT "MarketingImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingImportRowError" ADD CONSTRAINT "MarketingImportRowError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MarketingImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
