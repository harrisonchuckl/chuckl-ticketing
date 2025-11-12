import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// GET /calendar/:showId.ics
router.get("/:showId.ics", async (req, res) => {
  const { showId } = req.params;

  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { venue: true }
  });

  if (!show) return res.status(404).send("Not found");

  const dt = new Date(show.date);
  const dtstamp = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const title = show.title ?? "Event";
  const venueName = show.venue?.name ?? "";
  const address = show.venue?.address ?? "";
  const city = show.venue?.city ?? "";
  const postcode = show.venue?.postcode ?? "";

  const location = [venueName, address, city, postcode].filter(Boolean).join(", ");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chuckl Ticketing//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${show.id}@chuckl`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstamp}`,
    `SUMMARY:${escapeText(title)}`,
    `LOCATION:${escapeText(location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.send(ics);
});

function escapeText(s: string): string {
  return s.replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

export default router;