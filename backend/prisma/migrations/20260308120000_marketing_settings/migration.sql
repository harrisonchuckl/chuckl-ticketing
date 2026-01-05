CREATE TABLE "MarketingSettings" (
    "tenantId" TEXT NOT NULL,
    "defaultFromName" TEXT,
    "defaultFromEmail" TEXT,
    "defaultReplyTo" TEXT,
    "requireVerifiedFrom" BOOLEAN NOT NULL,
    "dailyLimitOverride" INTEGER,
    "sendRatePerSecOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "MarketingSettings" ADD CONSTRAINT "MarketingSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
