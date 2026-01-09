-- Add enum value for Product fulfilment: COLLECT_AT_SHOW
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ProductFulfilmentType'
      AND e.enumlabel = 'COLLECT_AT_SHOW'
  ) THEN
    ALTER TYPE "ProductFulfilmentType" ADD VALUE 'COLLECT_AT_SHOW';
  END IF;
END $$;
