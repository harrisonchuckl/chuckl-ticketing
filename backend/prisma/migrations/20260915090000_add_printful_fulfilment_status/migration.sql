ALTER TYPE "ProductOrderFulfilmentStatus" ADD VALUE IF NOT EXISTS 'ERROR';
ALTER TYPE "ProductOrderItemStatus" ADD VALUE IF NOT EXISTS 'ERROR';

ALTER TABLE "ProductOrderItem"
  ADD COLUMN IF NOT EXISTS "fulfilmentProviderOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "fulfilmentErrorMessage" TEXT;
