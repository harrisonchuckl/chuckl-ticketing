CREATE TABLE IF NOT EXISTS "ProductOrderItem" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "titleSnapshot" TEXT NOT NULL,
  "unitPricePenceSnapshot" INTEGER NOT NULL,
  "qty" INTEGER NOT NULL,
  "fulfilmentTypeSnapshot" "FulfilmentType" NOT NULL,
  "fulfilmentStatus" "FulfilmentStatus" NOT NULL DEFAULT 'PENDING',
  "collectCode" TEXT,
  CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductOrderItem_orderId_idx" ON "ProductOrderItem"("orderId");

ALTER TABLE "ProductOrderItem"
  ADD CONSTRAINT "ProductOrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
  ADD CONSTRAINT "ProductOrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
