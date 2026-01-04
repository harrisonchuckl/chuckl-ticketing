CREATE TYPE "OrganiserType" AS ENUM ('VENUE', 'PROMOTER', 'ARTIST', 'OTHER');
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

CREATE TABLE "OrganiserProfile" (
    "userId" TEXT NOT NULL,
    "organiserType" "OrganiserType" NOT NULL DEFAULT 'OTHER',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "subscriptionPlan" TEXT,
    "subscriptionPeriodEnd" TIMESTAMP(3),
    "permissionsJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganiserProfile_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "OrganiserProfile" ADD CONSTRAINT "OrganiserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
