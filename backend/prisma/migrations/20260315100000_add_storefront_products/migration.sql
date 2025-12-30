DO $$ BEGIN
  CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FulfilmentType" AS ENUM ('SHIPPING', 'COLLECT_AT_VENUE', 'DIGITAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FulfilmentStatus" AS ENUM (
    'PENDING',
    'PREPARING',
    'READY_FOR_COLLECTION',
    'COLLECTED',
    'DISPATCHED',
    'DELIVERED',
    'EMAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Storefront" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "bannerUrl" TEXT,
  CONSTRAINT "Storefront_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Storefront_slug_key" ON "Storefront"("slug");
CREATE INDEX IF NOT EXISTS "Storefront_ownerUserId_idx" ON "Storefront"("ownerUserId");

ALTER TABLE "Storefront"
  ADD CONSTRAINT "Storefront_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "storefrontId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "imageUrl" TEXT,
  "pricePence" INTEGER NOT NULL,
  "compareAtPricePence" INTEGER,
  "inventoryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "stockQty" INTEGER,
  "fulfilmentType" "FulfilmentType" NOT NULL,
  "collectInstructions" TEXT,
  "digitalDeliveryText" TEXT,
  "variantConfigJson" JSONB,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Product_storefrontId_slug_key" ON "Product"("storefrontId", "slug");
CREATE INDEX IF NOT EXISTS "Product_storefrontId_status_idx" ON "Product"("storefrontId", "status");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_storefrontId_fkey"
  FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
