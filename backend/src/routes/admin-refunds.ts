import { Router } from "express";
import { prisma } from "../utils/prisma";
import { z } from "zod";

const router = Router();

/**
 * POST /admin/refunds
 * Creates a refund against an order
 */
const CreateRefundBody = z.object({
  orderId: z.string().min(1),
  amountPence: z.number().int().positive(),
  reason: z.string().optional(),
  // optional metadata from Stripe/etc.
  processorId: z.string().optional(),
  stripeId: z.string().optional(),
  createdBy: z.string().optional(), // keep as simple string for now
});

router.post("/", async (req, res, next) => {
  try {
    const body = CreateRefundBody.parse(req.body);

    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        orderId: body.orderId,
        amount: body.amountPence, // mapped in schema as amountPence column
        reason: body.reason ?? null,
        processorId: body.processorId ?? null,
        stripeId: body.stripeId ?? null,
        createdBy: body.createdBy ?? null,
      },
    });

    res.status(201).json({ ok: true, refund });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/refunds/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const refund = await prisma.refund.findUnique({
      where: { id: req.params.id },
      include: {
        order: true,
      },
    });
    if (!refund) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, refund });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/refunds
 * Optional filters: orderId
 */
router.get("/", async (req, res, next) => {
  try {
    const { orderId } = req.query as { orderId?: string };
    const refunds = await prisma.refund.findMany({
      where: {
        orderId: orderId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      include: { order: true },
    });
    res.json({ ok: true, refunds });
  } catch (err) {
    next(err);
  }
});

export default router;
