ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_customerAccountId_idx" ON "Order"("customerAccountId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_customerAccountId_fkey"
  FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
