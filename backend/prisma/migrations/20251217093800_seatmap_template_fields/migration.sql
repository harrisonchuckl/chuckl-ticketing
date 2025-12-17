-- seatmap_template_fields
ALTER TABLE "SeatMap"
  ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SeatMap"
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
