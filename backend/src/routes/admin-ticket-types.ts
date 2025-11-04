// backend/src/routes/admin-ticket-types.ts
import { Router, Request, Response } from "express";
import { prisma } from "../db.js";

const router = Router();

// Guard with Admin Key
router.use((req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (!key || String(key) !== String(process.env.BOOTSTRAP_KEY)) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }
  next();
});

// List ticket types for a show
router.get("/shows/:showId/tickets", async (req: Request, res: Response) => {
  try {
    const { showId } = req.params;
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { ticketTypes: true },
    });
    if (!show) return res.status(404).json({ error: true, message: "Show not found" });
    res.json({ ok: true, show });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// Create a new ticket type
router.post("/shows/:showId/tickets", async (req: Request, res: Response) => {
  try {
    const { showId } = req.params;
    const { name, pricePence, available } = req.body;
    if (!name) return res.status(400).json({ error: true, message: "Name required" });
    const created = await prisma.ticketType.create({
      data: {
        showId,
        name,
        pricePence: Number(pricePence) || 0,
        available: available ? Number(available) : null,
      },
    });
    res.json({ ok: true, ticket: created });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// Update a ticket type
router.put("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, pricePence, available } = req.body;
    const updated = await prisma.ticketType.update({
      where: { id },
      data: {
        name,
        pricePence: Number(pricePence) || 0,
        available: available ? Number(available) : null,
      },
    });
    res.json({ ok: true, ticket: updated });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// Delete a ticket type
router.delete("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.ticketType.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: true, message: e.message });
  }
});

export default router;
