// backend/src/routes/admin-create-show.ts
import { Router, Request, Response } from "express";
import { prisma } from "../db.js";

const router = Router();

// -------- Admin guard (x-admin-key) ----------
router.use((req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }
  next();
});

// -------- Types ----------
type CreateShowBody = {
  title: string;
  description?: string;
  date: string; // ISO string from the UI
  venueId: string;
  pricePence: number; // integer, e.g. 2300 for £23.00
  capacityOverride?: number | null; // if provided, overrides venue.capacity
  imageUrl?: string | null; // store on Show.description or separate field later
};

// -------- Helpers ----------
function toInt(n: any): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : null;
}

// -------- List recent shows ----------
router.get("/shows/list", async (req: Request, res: Response) => {
  try {
    const limit = toInt(req.query.limit) ?? 50;
    const shows = await prisma.show.findMany({
      take: limit,
      orderBy: { date: "desc" },
      include: {
        venue: true,
        ticketTypes: true,
      },
    });
    res.json({ ok: true, shows });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// -------- Create a show (with initial TicketType) ----------
router.post("/shows/create", async (req: Request<{}, {}, CreateShowBody>, res: Response) => {
  try {
    const { title, description, date, venueId, pricePence, capacityOverride, imageUrl } = req.body;

    if (!title) return res.status(400).json({ error: true, message: "Title is required" });
    if (!date) return res.status(400).json({ error: true, message: "Date is required" });
    if (!venueId) return res.status(400).json({ error: true, message: "Venue is required" });

    const when = new Date(date);
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({ error: true, message: "Invalid date" });
    }

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) {
      return res.status(400).json({ error: true, message: "Venue not found" });
    }

    const capacity =
      capacityOverride !== null && capacityOverride !== undefined
        ? Number(capacityOverride)
        : venue.capacity ?? null;

    const created = await prisma.show.create({
      data: {
        title,
        description: buildDescriptionWithImage(description, imageUrl),
        date: when,
        venueId,
        ticketTypes: {
          create: [
            {
              name: "Standard",
              pricePence: Number(pricePence) || 0,
              available: capacity ?? null,
            },
          ],
        },
      },
      include: {
        venue: true,
        ticketTypes: true,
      },
    });

    // TODO (future): attach seatingMapId when we add that model
    // TODO (future): imageUrl as a real column

    res.json({ ok: true, show: created });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// -------- Utils ----------
function buildDescriptionWithImage(desc?: string, imageUrl?: string | null) {
  // Temporary: stash an image URL inside description block so you can display it in UI
  // Later we’ll add a proper Show.imageUrl column via migration.
  const clean = (desc ?? "").trim();
  const img = imageUrl ? `\n\n[image:${imageUrl}]` : "";
  return (clean + img).trim();
}

export default router;
