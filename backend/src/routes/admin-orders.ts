// backend/src/routes/admin-orders.ts
import { Router, Request, Response } from "express";
import { prisma } from "../db.js";

const router = Router();

function isAdmin(req: Request): boolean {
  const headerKey = (req.headers["x-admin-key"] ?? "") as string;
  const queryKey = (req.query.k ?? "") as string;
  const key = headerKey || queryKey;
  return !!key && String(key) === String(process.env.BOOTSTRAP_KEY);
}
function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: true, message: "Unauthorized" });
    return false;
  }
  return true;
}

/** List orders (optionally filter by showId or search by email/id) */
router.get("/orders", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { showId, q } = req.query;

  const where: any = {};
  if (showId) where.showId = String(showId);
  if (q) {
    const s = String(q);
    where.OR = [
      { email: { contains: s, mode: "insensitive" } },
      { id: { contains: s, mode: "insensitive" } }
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      show: { select: { title: true, date: true } },
      tickets: { select: { id: true, ticketType: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.json({ ok: true, orders });
});

export default router;
