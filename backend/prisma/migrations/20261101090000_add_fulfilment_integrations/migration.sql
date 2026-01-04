-- CreateEnum
CREATE TYPE "FulfilmentProvider" AS ENUM ('PRINTFUL', 'PRINTIFY', 'GELATO');

-- CreateTable
CREATE TABLE "FulfilmentIntegration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organiserId" TEXT NOT NULL,
    "provider" "FulfilmentProvider" NOT NULL,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),

    CONSTRAINT "FulfilmentIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfilmentProductMapping" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organiserId" TEXT NOT NULL,
    "provider" "FulfilmentProvider" NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "providerProductId" TEXT NOT NULL,
    "providerVariantId" TEXT,

    CONSTRAINT "FulfilmentProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FulfilmentIntegration_organiserId_idx" ON "FulfilmentIntegration"("organiserId");

-- CreateIndex
CREATE UNIQUE INDEX "FulfilmentIntegration_organiserId_provider_key" ON "FulfilmentIntegration"("organiserId", "provider");

-- CreateIndex
CREATE INDEX "FulfilmentProductMapping_organiserId_idx" ON "FulfilmentProductMapping"("organiserId");

-- CreateIndex
CREATE INDEX "FulfilmentProductMapping_productId_idx" ON "FulfilmentProductMapping"("productId");

-- CreateIndex
CREATE INDEX "FulfilmentProductMapping_productVariantId_idx" ON "FulfilmentProductMapping"("productVariantId");

-- CreateIndex
CREATE INDEX "FulfilmentProductMapping_provider_providerProductId_idx" ON "FulfilmentProductMapping"("provider", "providerProductId");

-- CreateIndex
CREATE UNIQUE INDEX "FulfilmentProductMapping_provider_productId_productVariantId_key" ON "FulfilmentProductMapping"("provider", "productId", "productVariantId");

-- AddForeignKey
ALTER TABLE "FulfilmentIntegration" ADD CONSTRAINT "FulfilmentIntegration_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentProductMapping" ADD CONSTRAINT "FulfilmentProductMapping_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentProductMapping" ADD CONSTRAINT "FulfilmentProductMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentProductMapping" ADD CONSTRAINT "FulfilmentProductMapping_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
