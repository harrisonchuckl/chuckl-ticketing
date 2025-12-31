-- Create new enums
DO $$
BEGIN
  CREATE TYPE "StorefrontStatus" AS ENUM ('DRAFT', 'LIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TaxMode" AS ENUM ('NONE', 'VAT', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductCategory" AS ENUM ('MERCH', 'ADDON', 'DIGITAL', 'DONATION', 'VOUCHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductFulfilmentType" AS ENUM ('SHIPPING', 'COLLECT', 'EMAIL', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InventoryMode" AS ENUM ('UNLIMITED', 'TRACKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductOrderSource" AS ENUM ('TICKET_CHECKOUT', 'STOREFRONT_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductOrderStatus" AS ENUM ('PAID', 'REFUNDED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductOrderFulfilmentStatus" AS ENUM ('UNFULFILLED', 'PARTIAL', 'FULFILLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductOrderItemStatus" AS ENUM ('UNFULFILLED', 'FULFILLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InventoryMovementReason" AS ENUM ('SALE', 'ADJUSTMENT', 'REFUND');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- Update Storefront table
ALTER TABLE "Storefront"
  ADD COLUMN IF NOT EXISTS "status" "StorefrontStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "brandColour" TEXT,
  ADD COLUMN IF NOT EXISTS "supportEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "policiesText" TEXT,
  ADD COLUMN IF NOT EXISTS "taxMode" "TaxMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "taxPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "collectionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "digitalEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "shippingFlatFeePence" INTEGER;

ALTER TABLE "Storefront" DROP COLUMN IF EXISTS "bannerUrl";

-- Update Product table
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "category" "ProductCategory" NOT NULL DEFAULT 'MERCH',
  ADD COLUMN IF NOT EXISTS "pricePence" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'gbp',
  ADD COLUMN IF NOT EXISTS "allowCustomAmount" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "inventoryMode" "InventoryMode" NOT NULL DEFAULT 'UNLIMITED',
  ADD COLUMN IF NOT EXISTS "stockCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER,
  ADD COLUMN IF NOT EXISTS "preorderEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "preorderCloseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "maxPerOrder" INTEGER,
  ADD COLUMN IF NOT EXISTS "maxPerTicket" INTEGER;

ALTER TABLE "Product" ALTER COLUMN "pricePence" DROP NOT NULL;

ALTER TABLE "Product" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "compareAtPricePence";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "inventoryEnabled";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "stockQty";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "collectInstructions";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "digitalDeliveryText";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "variantConfigJson";

-- Drop old ProductShowLink table
DROP TABLE IF EXISTS "ProductShowLink";

-- Drop old ProductOrderItem table (will be recreated)
DROP TABLE IF EXISTS "ProductOrderItem";

-- Create ProductVariant table
CREATE TABLE IF NOT EXISTS "ProductVariant" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "productId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sku" TEXT,
  "pricePenceOverride" INTEGER,
  "stockCountOverride" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- Create ProductImage table
CREATE TABLE IF NOT EXISTS "ProductImage" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "productId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");

-- Create UpsellRule table
CREATE TABLE IF NOT EXISTS "UpsellRule" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "storefrontId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT,
  "showId" TEXT,
  "ticketTypeId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "recommended" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "maxPerOrderOverride" INTEGER,
  "maxPerTicketOverride" INTEGER,

  CONSTRAINT "UpsellRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UpsellRule_storefrontId_idx" ON "UpsellRule"("storefrontId");
CREATE INDEX IF NOT EXISTS "UpsellRule_showId_active_priority_idx" ON "UpsellRule"("showId", "active", "priority");

-- Create ProductOrder table
CREATE TABLE IF NOT EXISTS "ProductOrder" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "storefrontId" TEXT NOT NULL,
  "orderId" TEXT,
  "source" "ProductOrderSource" NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "shippingAddressJson" JSONB,
  "subtotalPence" INTEGER NOT NULL,
  "taxPence" INTEGER NOT NULL,
  "shippingPence" INTEGER NOT NULL,
  "totalPence" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "ProductOrderStatus" NOT NULL,
  "fulfilmentStatus" "ProductOrderFulfilmentStatus" NOT NULL DEFAULT 'UNFULFILLED',

  CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductOrder_storefrontId_idx" ON "ProductOrder"("storefrontId");
CREATE INDEX IF NOT EXISTS "ProductOrder_stripeCheckoutSessionId_idx" ON "ProductOrder"("stripeCheckoutSessionId");

-- Create ProductOrderItem table
CREATE TABLE IF NOT EXISTS "ProductOrderItem" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "productOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "titleSnapshot" TEXT NOT NULL,
  "variantSnapshot" TEXT,
  "unitPricePence" INTEGER NOT NULL,
  "qty" INTEGER NOT NULL,
  "lineTotalPence" INTEGER NOT NULL,
  "fulfilmentTypeSnapshot" "ProductFulfilmentType" NOT NULL,
  "fulfilmentStatus" "ProductOrderItemStatus" NOT NULL DEFAULT 'UNFULFILLED',
  "metadataJson" JSONB,

  CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductOrderItem_productOrderId_idx" ON "ProductOrderItem"("productOrderId");

-- Create InventoryMovement table
CREATE TABLE IF NOT EXISTS "InventoryMovement" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "change" INTEGER NOT NULL,
  "reason" "InventoryMovementReason" NOT NULL,
  "refId" TEXT,

  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_variantId_idx" ON "InventoryMovement"("variantId");

-- Add foreign keys
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UpsellRule"
  ADD CONSTRAINT "UpsellRule_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpsellRule"
  ADD CONSTRAINT "UpsellRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpsellRule"
  ADD CONSTRAINT "UpsellRule_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UpsellRule"
  ADD CONSTRAINT "UpsellRule_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UpsellRule"
  ADD CONSTRAINT "UpsellRule_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductOrder"
  ADD CONSTRAINT "ProductOrder_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOrder"
  ADD CONSTRAINT "ProductOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
  ADD CONSTRAINT "ProductOrderItem_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItem"
  ADD CONSTRAINT "ProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItem"
  ADD CONSTRAINT "ProductOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
