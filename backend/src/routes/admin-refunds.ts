import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /admin/refunds
 * Body: { orderId: string, amount: number, reason?: string, processorId?: string, stripeId?: string }
 */
router.post("/", async (req, res) => {
  const { orderId, amount, reason, processorId, stripeId } = req.body ?? {};
  if (!orderId || typeof amount !== "number") {
    return res.status(400).json({ error: "orderId and amount (number) required" });
  }

  const refund = await prisma.refund.create({
    data: {
      orderId: String(orderId),
      amount,
      reason: reason ?? null,
      processorId: processorId ?? null,
      stripeId: stripeId ?? null
    }
  });

  return res.status(201).json(refund);
});

export default router;