import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.post("/track", async (req, res) => {
  try {
    const { showId, type, sessionId, orderId } = req.body || {};
    if (!showId || !type) {
      return res.status(400).json({ ok: false, error: "showId and type required" });
    }

    await prisma.showEvent.create({
      data: {
        showId: String(showId),
        type: String(type),
        sessionId: sessionId ? String(sessionId) : null,
        orderId: orderId ? String(orderId) : null,
        ts: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("public/track failed", err);
    res.status(500).json({ ok: false, error: "Failed to track event" });
  }
});

export default router;
