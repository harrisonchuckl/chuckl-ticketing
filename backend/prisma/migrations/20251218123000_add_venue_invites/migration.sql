-- CreateTable
CREATE TABLE "VenueInvite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "venueId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "VenueRole" NOT NULL DEFAULT 'READ_ONLY',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "VenueInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueInvite_venueId_idx" ON "VenueInvite"("venueId");

-- CreateIndex
CREATE INDEX "VenueInvite_email_idx" ON "VenueInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VenueInvite_tokenHash_key" ON "VenueInvite"("tokenHash");

-- AddForeignKey
ALTER TABLE "VenueInvite" ADD CONSTRAINT "VenueInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueInvite" ADD CONSTRAINT "VenueInvite_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

