CREATE TYPE "PrintfulShippingPolicy" AS ENUM ('PASS_THROUGH', 'INCLUDED', 'THRESHOLD');

ALTER TABLE "FulfilmentProductMapping"
ADD COLUMN "providerBasePricePence" INTEGER,
ADD COLUMN "providerBaseCurrency" TEXT DEFAULT 'gbp',
ADD COLUMN "providerBaseUpdatedAt" TIMESTAMP(3),
ADD COLUMN "providerShippingEstimatePence" INTEGER,
ADD COLUMN "providerTaxEstimatePence" INTEGER;

ALTER TABLE "Product"
ADD COLUMN "retailPricePence" INTEGER,
ADD COLUMN "compareAtPricePence" INTEGER,
ADD COLUMN "marginRuleUsed" TEXT;

ALTER TABLE "ProductOrder"
ADD COLUMN "printfulOrderId" TEXT,
ADD COLUMN "printfulCostSubtotalPence" INTEGER,
ADD COLUMN "printfulShippingPence" INTEGER,
ADD COLUMN "printfulTaxPence" INTEGER,
ADD COLUMN "printfulTotalPence" INTEGER,
ADD COLUMN "printfulCostCurrency" TEXT,
ADD COLUMN "printfulCostRawJson" JSONB;

CREATE TABLE "PrintfulPricingConfig" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organiserId" TEXT NOT NULL,
    "marginBps" INTEGER NOT NULL DEFAULT 1500,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT true,
    "vatRateBps" INTEGER NOT NULL DEFAULT 2000,
    "shippingPolicy" "PrintfulShippingPolicy" NOT NULL DEFAULT 'PASS_THROUGH',
    "stripeFeeBps" INTEGER NOT NULL DEFAULT 150,
    "stripeFeeFixedPence" INTEGER NOT NULL DEFAULT 20,
    "allowNegativeMargin" BOOLEAN NOT NULL DEFAULT false,
    "minimumProfitPence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrintfulPricingConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrintfulPricingConfig_organiserId_key" ON "PrintfulPricingConfig"("organiserId");
CREATE INDEX "PrintfulPricingConfig_organiserId_idx" ON "PrintfulPricingConfig"("organiserId");

ALTER TABLE "PrintfulPricingConfig" ADD CONSTRAINT "PrintfulPricingConfig_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductOrderProfitSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productOrderId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "retailSubtotalPence" INTEGER NOT NULL,
    "retailShippingPence" INTEGER NOT NULL,
    "retailTaxPence" INTEGER NOT NULL,
    "retailTotalPence" INTEGER NOT NULL,
    "printfulSubtotalPence" INTEGER NOT NULL,
    "printfulShippingPence" INTEGER NOT NULL,
    "printfulTaxPence" INTEGER NOT NULL,
    "printfulTotalPence" INTEGER NOT NULL,
    "stripeFeePence" INTEGER NOT NULL,
    "vatEstimatePence" INTEGER NOT NULL,
    "netProfitPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "marginBpsUsed" INTEGER NOT NULL,
    "vatRateBpsUsed" INTEGER NOT NULL,
    "shippingPolicyUsed" "PrintfulShippingPolicy" NOT NULL,
    "negativeMargin" BOOLEAN NOT NULL DEFAULT false,
    "missingPrintfulCost" BOOLEAN NOT NULL DEFAULT false,
    "organiserSharePence" INTEGER NOT NULL DEFAULT 0,
    "platformSharePence" INTEGER NOT NULL DEFAULT 0,
    "creatorSharePence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOrderProfitSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductOrderProfitSnapshot_productOrderId_key" ON "ProductOrderProfitSnapshot"("productOrderId");
CREATE INDEX "ProductOrderProfitSnapshot_organiserId_idx" ON "ProductOrderProfitSnapshot"("organiserId");

ALTER TABLE "ProductOrderProfitSnapshot" ADD CONSTRAINT "ProductOrderProfitSnapshot_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductOrderProfitSnapshot" ADD CONSTRAINT "ProductOrderProfitSnapshot_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductOrderItemProfitSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productOrderItemId" TEXT NOT NULL,
    "profitSnapshotId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "retailUnitPricePence" INTEGER NOT NULL,
    "retailLineTotalPence" INTEGER NOT NULL,
    "printfulUnitCostPence" INTEGER NOT NULL,
    "printfulLineTotalPence" INTEGER NOT NULL,
    "stripeFeePence" INTEGER NOT NULL,
    "vatEstimatePence" INTEGER NOT NULL,
    "netProfitPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "marginBpsUsed" INTEGER NOT NULL,
    "negativeMargin" BOOLEAN NOT NULL DEFAULT false,
    "organiserSharePence" INTEGER NOT NULL DEFAULT 0,
    "platformSharePence" INTEGER NOT NULL DEFAULT 0,
    "creatorSharePence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOrderItemProfitSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductOrderItemProfitSnapshot_productOrderItemId_key" ON "ProductOrderItemProfitSnapshot"("productOrderItemId");
CREATE INDEX "ProductOrderItemProfitSnapshot_organiserId_idx" ON "ProductOrderItemProfitSnapshot"("organiserId");

ALTER TABLE "ProductOrderItemProfitSnapshot" ADD CONSTRAINT "ProductOrderItemProfitSnapshot_productOrderItemId_fkey" FOREIGN KEY ("productOrderItemId") REFERENCES "ProductOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItemProfitSnapshot" ADD CONSTRAINT "ProductOrderItemProfitSnapshot_profitSnapshotId_fkey" FOREIGN KEY ("profitSnapshotId") REFERENCES "ProductOrderProfitSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItemProfitSnapshot" ADD CONSTRAINT "ProductOrderItemProfitSnapshot_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
