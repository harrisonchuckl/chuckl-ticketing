ALTER TABLE "CustomerAccount"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationTokenHash" TEXT,
ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);

UPDATE "CustomerAccount"
SET "emailVerifiedAt" = NOW()
WHERE "emailVerifiedAt" IS NULL;
