import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { sendTicketsEmail } from "../services/email.js";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /admin/customers
 * Returns 1 row per customer, grouped from Orders.
 *
 * Customer identity priority:
 *  - Order.email (guest checkout)
 *  - Order.user.email (if userId exists)
 *
 * NOTE: Ticket table is currently empty in your DB, so totalTickets uses:
 *  - sum(Order.quantity) when present
 *  - else falls back to 1 per order
 */
router.get("/customers", requireAdminOrOrganiser, async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        status: true,
        amountPence: true,
        quantity: true,
        email: true,
        userId: true,
        showId: true,
        stripeId: true,
        stripeCheckoutSessionId: true,
        show: {
          select: {
            id: true,
            title: true,
            status: true,
            date: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    router.post("/orders/:orderId/reissue-email", requireAdminOrOrganiser, async (req, res) => {
  try {
    const orderId = String(req.params.orderId);

    // Optional override if you ever want to send to a different address:
    const to =
      typeof (req.body as any)?.to === "string" && (req.body as any).trim()
        ? String((req.body as any).to).trim()
        : undefined;

    const result = await sendTicketsEmail(orderId, to);

    if (!result?.ok) {
      return res.status(400).json({
        ok: false,
        message: result?.message || "Failed to reissue email.",
      });
    }

    return res.json({
      ok: true,
      message: result?.message || "Reissue email sent.",
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      message: err?.message || "Server error reissuing email.",
    });
  }
});


    // Group orders into "customers"
    type CustomerAgg = {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      totalOrders: number;
      totalTickets: number;
      totalSpend: number; // pounds
      lastPurchase: string | null; // ISO
      showsBought: number;
      lastShow: string | null;
      loyalty: string;
      marketingConsent: boolean;
      notes: string;
      tags: string[];
      orders: Array<{
        ref: string;
        show: string;
        date: string;
        qty: number;
        total: number; // pounds
        status: string;
        isLive: boolean;
      }>;
    };

    const map = new Map<string, CustomerAgg>();

    function toPounds(pence: number | null | undefined) {
      const n = typeof pence === "number" ? pence : 0;
      return Math.round(n) / 100;
    }

    function safeEmail(o: any) {
      return (o?.email || o?.user?.email || "").trim().toLowerCase();
    }

    function displayName(o: any) {
      const n = (o?.user?.name || "").trim();
      if (n) return n;
      const e = safeEmail(o);
      if (!e) return "Unknown";
      return e.split("@")[0];
    }

    function makeCustomerId(email: string) {
      // Stable-ish ID for UI (no new DB table required)
      return "CUST-" + email.replace(/[^a-z0-9]/g, "").slice(0, 12).toUpperCase();
    }

    for (const o of orders) {
      const email = safeEmail(o);
      if (!email) continue; // If both Order.email + User.email are missing, we cannot form a customer

      const showTitle = (o.show?.title || "Unknown show").trim();
      const isLive = o.show?.status === "LIVE";

      const qty =
        typeof o.quantity === "number"
          ? o.quantity
          : 1; // fallback while Ticket table is empty

      const total = toPounds(o.amountPence);

      const existing = map.get(email);
      if (!existing) {
        map.set(email, {
          id: makeCustomerId(email),
          name: displayName(o),
          email,
          phone: null,
          totalOrders: 0,
          totalTickets: 0,
          totalSpend: 0,
          lastPurchase: null,
          showsBought: 0,
          lastShow: null,
          loyalty: "New",
          marketingConsent: false,
          notes: "",
          tags: [],
          orders: [],
        });
      }

      const c = map.get(email)!;

      c.totalOrders += 1;
      c.totalTickets += qty;
      c.totalSpend += total;

      // last purchase
      const dIso = o.createdAt.toISOString();
      if (!c.lastPurchase || new Date(dIso) > new Date(c.lastPurchase)) {
        c.lastPurchase = dIso;
        c.lastShow = showTitle;
      }

      c.orders.push({
        ref: o.id,
        show: showTitle,
        date: dIso,
        qty,
        total,
        status: String(o.status || "PENDING"),
        isLive,
      });
    }

    // Finalise derived fields
    const items = Array.from(map.values()).map((c) => {
      const uniqueShows = new Set(c.orders.map((o) => o.show).filter(Boolean));
      c.showsBought = uniqueShows.size;

      // simple loyalty banding (keeps your UI pill functionality)
      if (c.totalOrders >= 8) c.loyalty = "VIP";
      else if (c.totalOrders >= 3) c.loyalty = "Repeat";
      else if (c.totalOrders === 1) c.loyalty = "Single";
      else c.loyalty = "New";

      // round pounds to 2dp for display consistency
      c.totalSpend = Math.round(c.totalSpend * 100) / 100;

      return c;
    });

    res.json({ ok: true, items });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to load customers" });
  }
});

export default router;
