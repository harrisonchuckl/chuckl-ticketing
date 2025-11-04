// backend/src/routes/admin-manage.ts
import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

function keyOk(req: any) {
  const k = req.headers["x-admin-key"] || req.query.k;
  return k && String(k) === String(process.env.BOOTSTRAP_KEY);
}
const unauth = (res: any) => res.status(401).json({ error: true, message: "Unauthorized" });

router.get("/venues", async (req, res) => {
  if (!keyOk(req)) return unauth(res);
  const venues = await prisma.venue.findMany({
    select: { id: true, name: true, city: true, postcode: true, capacity: true },
    orderBy: { name: "asc" },
  });
  res.json({ ok: true, venues });
});

router.get("/shows/:id", async (req, res) => {
  if (!keyOk(req)) return unauth(res);
  const s = await prisma.show.findUnique({
    where: { id: String(req.params.id) },
    include: {
      venue: true,
      ticketTypes: true,
      _count: { select: { tickets: true, orders: true } },
    },
  });
  if (!s) return res.status(404).json({ error: true, message: "Not found" });
  res.json({ ok: true, show: s });
});

router.post("/shows", async (req, res) => {
  if (!keyOk(req)) return unauth(res);
  try {
    const { title, description, date, venueId, ticketType } = req.body;
    if (!title || !venueId || !date)
      return res.status(400).json({ error: true, message: "Missing fields" });

    const created = await prisma.show.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        venue: { connect: { id: venueId } },
        ticketTypes: ticketType
          ? {
              create: {
                name: ticketType.name || "General Admission",
                pricePence: ticketType.pricePence || 0,
                available: ticketType.available ?? null,
              },
            }
          : undefined,
      },
    });
    res.json({ ok: true, id: created.id });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message || String(e) });
  }
});

export default router;
