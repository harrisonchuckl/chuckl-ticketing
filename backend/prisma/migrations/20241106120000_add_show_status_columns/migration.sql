-- Ensure the ShowStatus enum exists for show publishing
DO $$
BEGIN
  CREATE TYPE "ShowStatus" AS ENUM ('DRAFT', 'LIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add publishing metadata columns to shows
ALTER TABLE "Show"
ADD COLUMN IF NOT EXISTS "status" "ShowStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "Show"
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Make sure the default stays in place if the column already existed
DO $$
BEGIN
  ALTER TABLE "Show" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;
