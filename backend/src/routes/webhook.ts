import express, { Router } from "express";
import prisma from "../lib/prisma.js";
import Stripe from "stripe";
import { calcFeesForShow } from "../services/fees.js";
import { sendTicketsEmail } from "../services/email.js";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const StripeClient = (Stripe as any)?.default || Stripe;

const stripe: Stripe | null = stripeSecret
  ? new StripeClient(stripeSecret, { apiVersion: "2024-06-20" })
  : null;

const router = Router();

function markSeatsSold(layout: any, seatIds: string[]): any {
  const seatSet = new Set(seatIds);

  const mutateNode = (node: any) => {
    if (!node || typeof node !== "object") return;

    const attrs = node.attrs || node;

    const isSeat =
      (attrs.isSeat || attrs.isSeat === "true") &&
      (node.className === "Circle" || attrs.className === "Circle" || typeof attrs.radius === "number");

    const sbSeatId = attrs.sbSeatId;
    const id = attrs.id;

    const matches =
      (typeof sbSeatId === "string" && seatSet.has(sbSeatId)) || (typeof id === "string" && seatSet.has(id));

    if (isSeat && matches) {
      attrs.status = "SOLD";
      attrs.sbHoldStatus = "sold";
    }

    if (node.attrs) node.attrs = attrs;

    if (Array.isArray(node.children)) {
      node.children.forEach(mutateNode);
    }
  };

  let root = layout;
  let wasString = false;

  if (typeof root === "string") {
    wasString = true;
    try {
      root = JSON.parse(root);
    } catch {
      return layout;
    }
  }

  mutateNode(root);
  return wasString ? JSON.stringify(root) : root;
}

async function getTableNameCaseInsensitive(target: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<
    Array<{ table_name: string }>
  >`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND lower(table_name)=lower(${target}) LIMIT 1`;
  return rows?.[0]?.table_name ?? null;
}

async function getTableCols(tableName: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${tableName}
  `;
  return new Set((rows || []).map(r => r.column_name));
}

async function countByOrderId(tableName: string, cols: Set<string>, orderId: string): Promise<number> {
  if (!cols.has("orderId")) return 0; // can't check idempotency safely
  const rows = await prisma.$queryRawUnsafe<Array<{ c: any }>>(
    `SELECT COUNT(*)::int as c FROM "${tableName}" WHERE "orderId"=$1`,
    orderId
  );
  return Number(rows?.[0]?.c ?? 0);
}

async function insertRow(tableName: string, cols: Set<string>, row: Record<string, any>) {
  // Only insert keys that actually exist on the table
  const keys = Object.keys(row).filter(k => cols.has(k) && row[k] !== undefined);

  if (!keys.length) return;

  const colSql = keys.map(k => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map(k => row[k]);

  const sql = `INSERT INTO "${tableName}" (${colSql}) VALUES (${placeholders})`;
  await prisma.$executeRawUnsafe(sql, ...values);
}


/**
 * Stripe webhook endpoint:
 * Mounted in app.ts as: app.use("/webhook", webhookRouter)
 * So the final URL is: POST /webhook/stripe
 */
router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe) return res.status(500).send("Stripe not configured");

    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig) return res.status(400).send("No signature");

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    if (event.type !== "checkout.session.completed") {
      return res.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const showId = session.metadata?.showId;

    const seatIdsRaw = session.metadata?.seatIds || "";
    const seatIds = seatIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (!orderId || !showId) {
      console.warn("webhook: missing orderId/showId metadata", { orderId, showId });
      return res.json({ received: true });
    }

    // Load order to compute fees precisely
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        amountPence: true,
        quantity: true,
        userId: true,
        status: true,
      },
    });

    if (!order) {
      console.warn("webhook: order not found", { orderId });
      return res.json({ received: true });
    }

    let organiserSplitBps: number | null = null;
    if (order.userId) {
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { organiserSplitBps: true },
      });
      organiserSplitBps = user?.organiserSplitBps ?? null;
    }

    const fees = await calcFeesForShow(
      showId,
      Number(order.amountPence ?? 0),
      Number(order.quantity ?? 0),
      organiserSplitBps ?? undefined
    );

    const payerEmail =
      session.customer_details?.email || session.customer_email || undefined;

    // Update order -> PAID + store fee breakdown
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAID",
        platformFeePence: fees.platformFeePence,
        organiserSharePence: fees.organiserSharePence,
        paymentFeePence: fees.paymentFeePence,
        netPayoutPence: fees.netPayoutPence,
        stripeId: session.payment_intent as string,
        email: payerEmail,
      },
    });

        // -----------------------------
    // CREATE TICKETS (idempotent)
    // -----------------------------
    try {
      const ticketTable = await getTableNameCaseInsensitive("Ticket");

      if (!ticketTable) {
        console.warn("[webhook] Ticket table not found in DB (skipping ticket creation)");
      } else {
        const ticketCols = await getTableCols(ticketTable);

        // If tickets already exist for this order, don’t recreate (webhooks retry)
        const existing = await countByOrderId(ticketTable, ticketCols, orderId);
        if (existing > 0) {
          console.info("[webhook] tickets already exist, skipping", { orderId, existing });
        } else {
          const seatGroupsRaw = session.metadata?.seatGroups || "";
          const gaTicketTypeId = session.metadata?.ticketTypeId || "";

          // Tiered seating mode: seatGroups contains [{ticketTypeId, unitPricePence, seatIds[]}]
          if (seatGroupsRaw) {
            let seatGroups: Array<{ ticketTypeId: string; unitPricePence: number; seatIds: string[] }> = [];
            try {
              seatGroups = JSON.parse(seatGroupsRaw);
            } catch {
              console.warn("[webhook] invalid seatGroups JSON (skipping tiered ticket mapping)", { orderId });
            }

            let created = 0;

            for (const g of seatGroups) {
              const ttId = String(g.ticketTypeId || "").trim();
              const unit = Number(g.unitPricePence || 0);
              const ids = Array.isArray(g.seatIds) ? g.seatIds.map(s => String(s)) : [];

              for (const sbSeatId of ids) {
                await insertRow(ticketTable, ticketCols, {
                  orderId,
                  showId,
                  ticketTypeId: ttId || undefined,
                  // some schemas use seatId, some use sbSeatId — we set both if they exist
                  seatId: sbSeatId,
                  sbSeatId: sbSeatId,
                  pricePence: unit,
                  unitPricePence: unit,
                  amountPence: unit,
                  status: "SOLD",
                });
                created++;
              }
            }

            console.info("[webhook] created tiered tickets", { orderId, created });
          }

          // GA mode: 1 ticket row per seat OR single row w/ quantity (depends on your schema)
          else if (gaTicketTypeId) {
            const qty = Number(order.quantity || 0);

            // Try “quantity column exists” approach first, else fall back to 1 row per ticket
            if (ticketCols.has("quantity")) {
              await insertRow(ticketTable, ticketCols, {
                orderId,
                showId,
                ticketTypeId: String(gaTicketTypeId),
                quantity: qty,
                pricePence: undefined,
                unitPricePence: undefined,
                amountPence: undefined,
                status: "SOLD",
              });

              console.info("[webhook] created GA ticket row (quantity)", { orderId, qty });
            } else {
              let created = 0;
              for (let i = 0; i < qty; i++) {
                await insertRow(ticketTable, ticketCols, {
                  orderId,
                  showId,
                  ticketTypeId: String(gaTicketTypeId),
                  status: "SOLD",
                });
                created++;
              }

              console.info("[webhook] created GA ticket rows (per-ticket)", { orderId, created });
            }
          } else {
            console.warn("[webhook] no seatGroups + no ticketTypeId metadata (cannot create tickets)", { orderId });
          }
        }
      }
    } catch (ticketErr: any) {
      console.error("[webhook] ticket creation failed", {
        orderId,
        message: ticketErr?.message,
        stack: ticketErr?.stack,
      });
    }


    // Only send the email the first time we flip to PAID (webhooks retry)
    if (order.status !== "PAID") {
      try {
        await sendTicketsEmail(orderId);
        console.info("webhook: tickets email sent", { orderId });
      } catch (emailErr: any) {
        console.error("webhook: confirmation email failed", {
          orderId,
          message: emailErr?.message,
          stack: emailErr?.stack,
        });
      }
    } else {
      console.info("webhook: order already PAID, skipping email", { orderId });
    }

    // Mark sold seats on active seatmap (best-effort)
    if (seatIds.length > 0) {
      const show = await prisma.show.findUnique({
        where: { id: showId },
        select: { activeSeatMapId: true },
      });

      let seatMap =
        show?.activeSeatMapId
          ? await prisma.seatMap.findUnique({ where: { id: show.activeSeatMapId } })
          : null;

      if (!seatMap) {
        seatMap = await prisma.seatMap.findFirst({
          where: { showId },
          orderBy: { updatedAt: "desc" },
        });
      }

      console.log("[webhook] seat sell update", {
        showId,
        activeSeatMapId: show?.activeSeatMapId ?? null,
        seatMapIdUsed: seatMap?.id ?? null,
        seatIdsCount: seatIds.length,
        seatIdsSample: seatIds.slice(0, 10),
      });

      if (seatMap && seatMap.layout) {
        let layout: any = seatMap.layout as any;

        if (layout.konvaJson) {
          layout = {
            ...layout,
            konvaJson: markSeatsSold(layout.konvaJson, seatIds),
          };
        } else {
          layout = markSeatsSold(layout, seatIds);
        }

        await prisma.seatMap.update({
          where: { id: seatMap.id },
          data: { layout },
        });
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error("stripe webhook error", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
