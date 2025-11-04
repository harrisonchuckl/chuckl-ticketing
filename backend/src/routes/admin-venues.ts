// backend/src/routes/admin-venues.ts
import { Router, Request, Response } from "express";
import { prisma } from "../db.js"; // ✅ correct path

const router = Router();

// Admin key guard
router.use((req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }
  next();
});

// List venues
router.get("/venues/list", async (_req: Request, res: Response) => {
  try {
    const venues = await prisma.venue.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postcode: true,
        capacity: true,
        createdAt: true,
      },
    });
    res.json({ ok: true, venues });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// Create a new venue
router.post("/venues/create", async (req: Request, res: Response) => {
  try {
    const { name, address, city, postcode, capacity } = req.body;
    if (!name)
      return res.status(400).json({ error: true, message: "Name required" });

    const venue = await prisma.venue.create({
      data: {
        name,
        address,
        city,
        postcode,
        capacity: capacity ? Number(capacity) : null,
      },
    });
    res.json({ ok: true, venue });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// Update venue
router.put("/venues/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, city, postcode, capacity } = req.body;

    const updated = await prisma.venue.update({
      where: { id },
      data: {
        name,
        address,
        city,
        postcode,
        capacity: capacity ? Number(capacity) : null,
      },
    });
    res.json({ ok: true, venue: updated });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// Delete venue
router.delete("/venues/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.venue.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

export default router;
