-- CreateEnum
CREATE TYPE "PromoterStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'DORMANT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PromoterDocumentStatus" AS ENUM ('MISSING', 'UPLOADED', 'EXPIRED', 'APPROVED');

-- CreateEnum
CREATE TYPE "PromoterDocumentType" AS ENUM ('PRS_CERTIFICATE', 'PPL_MUSIC_LICENSING', 'PUBLIC_LIABILITY_INSURANCE', 'RISK_ASSESSMENT', 'TECH_SPEC', 'MARKETING_SPEC', 'ACCESSIBILITY_INFO', 'BRANDING_GUIDELINES', 'OTHER');

-- CreateEnum
CREATE TYPE "PromoterActivityType" AS ENUM ('CREATED', 'UPDATED', 'CONTACT_ADDED', 'CONTACT_UPDATED', 'CONTACT_REMOVED', 'DOCUMENT_UPLOADED', 'DOCUMENT_UPDATED', 'DOCUMENT_REMOVED');

-- CreateTable
CREATE TABLE "Promoter" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "tradingName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyNumber" TEXT,
    "vatNumber" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "county" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "status" "PromoterStatus" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "ownerId" TEXT,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterContact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "promoterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPrimaryFinance" BOOLEAN NOT NULL DEFAULT false,
    "isPrimaryMarketing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PromoterContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterDocument" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "promoterId" TEXT NOT NULL,
    "venueId" TEXT,
    "type" "PromoterDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "status" "PromoterDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedByUserId" TEXT,

    CONSTRAINT "PromoterDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promoterId" TEXT NOT NULL,
    "type" "PromoterActivityType" NOT NULL,
    "metadata" JSONB,
    "createdByUserId" TEXT,

    CONSTRAINT "PromoterActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_name_key" ON "Promoter"("name");

-- CreateIndex
CREATE INDEX "PromoterContact_promoterId_idx" ON "PromoterContact"("promoterId");

-- CreateIndex
CREATE INDEX "PromoterDocument_promoterId_idx" ON "PromoterDocument"("promoterId");

-- CreateIndex
CREATE INDEX "PromoterActivity_promoterId_idx" ON "PromoterActivity"("promoterId");

-- AddForeignKey
ALTER TABLE "Promoter" ADD CONSTRAINT "Promoter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterContact" ADD CONSTRAINT "PromoterContact_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterDocument" ADD CONSTRAINT "PromoterDocument_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterDocument" ADD CONSTRAINT "PromoterDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterActivity" ADD CONSTRAINT "PromoterActivity_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterActivity" ADD CONSTRAINT "PromoterActivity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
