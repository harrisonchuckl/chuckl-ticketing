-- Add video URL fields to shows
ALTER TABLE "Show"
ADD COLUMN IF NOT EXISTS "videoUrlOne" TEXT,
ADD COLUMN IF NOT EXISTS "videoUrlTwo" TEXT;
