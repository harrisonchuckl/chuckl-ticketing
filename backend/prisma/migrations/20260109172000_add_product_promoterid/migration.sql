-- Add optional promoterId to Product (schema expects this column)
ALTER TABLE "Product"
ADD COLUMN "promoterId" TEXT;

-- Match schema index: @@index([storefrontId, promoterId])
CREATE INDEX "Product_storefrontId_promoterId_idx"
ON "Product" ("storefrontId", "promoterId");

-- Optional relation to Promoter (matches schema relation)
ALTER TABLE "Product"
ADD CONSTRAINT "Product_promoterId_fkey"
FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
