import prisma from "../lib/prisma.js";
import { lookupPostcode } from "../lib/postcode.js";

type VenueRow = {
  id: string;
  name: string;
  postcode: string | null;
  city: string | null;
  county: string | null;
};

function needsUpdate(venue: VenueRow) {
  const hasPostcode = Boolean(venue.postcode && venue.postcode.trim());
  const missingCity = !venue.city || !venue.city.trim();
  const missingCounty = !venue.county || !venue.county.trim();
  return hasPostcode && (missingCity || missingCounty);
}

async function run() {
  const venues = await prisma.venue.findMany({
    select: { id: true, name: true, postcode: true, city: true, county: true },
  });

  const targets = venues.filter(needsUpdate);
  console.log(`Found ${targets.length} venues with missing city/county.`);

  for (const venue of targets) {
    const postcode = venue.postcode ? venue.postcode.trim() : "";
    if (!postcode) continue;
    const lookup = await lookupPostcode(postcode);
    if (!lookup) {
      console.log(`No lookup result for ${venue.name} (${postcode}).`);
      continue;
    }

    await prisma.venue.update({
      where: { id: venue.id },
      data: {
        city: venue.city && venue.city.trim() ? venue.city.trim() : lookup.city,
        county: venue.county && venue.county.trim() ? venue.county.trim() : lookup.county,
        postcode: lookup.postcode,
      },
    });

    console.log(`Updated ${venue.name}: ${lookup.city ?? "-"} / ${lookup.county ?? "-"}`);
  }
}

run()
  .catch((err) => {
    console.error("Failed to backfill venues", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
