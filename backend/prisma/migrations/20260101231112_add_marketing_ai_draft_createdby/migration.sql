-- Recreated migration:
-- This migration exists in Railway’s _prisma_migrations but the folder was missing from the repo.
-- The DB already has these changes; we make this idempotent so fresh DBs can still migrate safely.

-- Add createdByUserId column (matches prisma/schema.prisma: MarketingAiDraft.createdByUserId)
ALTER TABLE "MarketingAiDraft"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

-- Index for createdByUserId (Prisma commonly generates this)
CREATE INDEX IF NOT EXISTS "MarketingAiDraft_createdByUserId_idx"
  ON "MarketingAiDraft" ("createdByUserId");

-- FK constraint to User(id)
DO $$
BEGIN
  ALTER TABLE "MarketingAiDraft"
    ADD CONSTRAINT "MarketingAiDraft_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
