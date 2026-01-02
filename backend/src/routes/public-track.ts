import { Router } from "express";
import { ShowEventType } from "@prisma/client";
import prisma from "../lib/prisma.js";

const router = Router();

router.post("/track", async (req, res) => {
  try {
    const { showId, type, sessionId, orderId, customerEmail } = req.body || {};
    if (!showId || !type) {
      return res.status(400).json({ ok: false, error: "showId and type required" });
    }

    const typeValue = String(type);
    if (!Object.values(ShowEventType).includes(typeValue as ShowEventType)) {
      return res.status(400).json({ ok: false, error: "Invalid event type" });
    }

    const event = await prisma.showEvent.create({
      data: {
        showId: String(showId),
        type: typeValue as ShowEventType,
        sessionId: sessionId ? String(sessionId) : null,
        orderId: orderId ? String(orderId) : null,
        ts: new Date(),
      },
    });

    const show = await prisma.show.findFirst({
      where: { id: String(showId) },
      select: { organiserId: true },
    });

    if (show?.organiserId) {
      await prisma.crmEventView.create({
        data: {
          organiserId: String(show.organiserId),
          showId: String(showId),
          eventType: typeValue as ShowEventType,
          sessionId: sessionId ? String(sessionId) : null,
          customerEmail: customerEmail ? String(customerEmail) : null,
          viewedAt: new Date(),
        },
      });
    }

    res.json({ ok: true, eventId: event.id });
  } catch (err) {
    console.error("public/track failed", err);
    res.status(500).json({ ok: false, error: "Failed to track event" });
  }
});

export default router;
