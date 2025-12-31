-- Unify Product.fulfilmentType from "FulfilmentType" -> "ProductFulfilmentType"

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "fulfilmentType_new" "ProductFulfilmentType" NOT NULL DEFAULT 'NONE';

UPDATE "Product"
SET "fulfilmentType_new" = CASE ("fulfilmentType"::text)
  WHEN 'SHIPPING' THEN 'SHIPPING'::"ProductFulfilmentType"
  WHEN 'COLLECT_AT_VENUE' THEN 'COLLECT'::"ProductFulfilmentType"
  WHEN 'DIGITAL' THEN 'EMAIL'::"ProductFulfilmentType"
  ELSE 'NONE'::"ProductFulfilmentType"
END;

ALTER TABLE "Product" DROP COLUMN IF EXISTS "fulfilmentType";
ALTER TABLE "Product" RENAME COLUMN "fulfilmentType_new" TO "fulfilmentType";

