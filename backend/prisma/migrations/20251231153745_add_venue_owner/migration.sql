-- Add ownerId to Venue for organiser scoping
ALTER TABLE "Venue" ADD COLUMN "ownerId" TEXT;

-- Add foreign key to User
ALTER TABLE "Venue"
  ADD CONSTRAINT "Venue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for owner scoping
CREATE INDEX "Venue_ownerId_idx" ON "Venue"("ownerId");
