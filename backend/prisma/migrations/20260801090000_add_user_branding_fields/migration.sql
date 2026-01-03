-- Add organiser branding fields
ALTER TABLE "User"
  ADD COLUMN "brandLogoUrl" TEXT,
  ADD COLUMN "brandColorRgb" TEXT,
  ADD COLUMN "brandColorHex" TEXT;
