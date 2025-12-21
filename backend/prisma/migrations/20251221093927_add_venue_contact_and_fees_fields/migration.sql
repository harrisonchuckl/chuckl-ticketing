ALTER TABLE "Venue"
  ADD COLUMN IF NOT EXISTS "imageUrl" text,
  ADD COLUMN IF NOT EXISTS "contactName" text,
  ADD COLUMN IF NOT EXISTS "contactEmail" text,
  ADD COLUMN IF NOT EXISTS "contactPhone" text,
  ADD COLUMN IF NOT EXISTS "ticketContraBps" integer,
  ADD COLUMN IF NOT EXISTS "bookingFeeBps" integer,
  ADD COLUMN IF NOT EXISTS "spaces" text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS "seatingMaps" text[] NOT NULL DEFAULT ARRAY[]::text[];
