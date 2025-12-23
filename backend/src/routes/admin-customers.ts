import { Router } from "express";
import { PrismaClient, OrderStatus, ShowStatus } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /admin/customers
 * Returns a customer list derived from real Orders (and Users when present).
 *
 * Query params (optional):
 *  - q: search string (matches email, user name, order id, show title)
 *  - status: OrderStatus or "any"
 *  - show: show title exact match (used by UI "All live shows" filter)
 *  - range: "30" | "90" | "365" | "any"  (days since last purchase)
 */
router.get("/customers", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "any").trim();
    const show = String(req.query.show || "").trim();
    const range = String(req.query.range || "any").trim();

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const rangeDays =
      range === "30" ? 30 :
      range === "90" ? 90 :
      range === "365" ? 365 :
      null;

    // Pull orders with related show/user/tickets to build customer aggregates
    const orders = await prisma.order.findMany({
      where: {
        // Only include orders that have some customer identity
        OR: [{ email: { not: null } }, { userId: { not: null } }],

        ...(status && status !== "any"
          ? { status: status as OrderStatus }
          : {}),

        ...(q
          ? {
              OR: [
                { id: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { user: { name: { contains: q, mode: "insensitive" } } },
                { show: { title: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),

        ...(show
          ? { show: { title: show } }
          : {}),
      },
      include: {
        show: { select: { title: true, date: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
        tickets: { select: { quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500, // MVP cap; tweak later if needed
    });

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
      marketingConsent: boolean | null;
      notes: string | null;
      tags: string[];
      orders: Array<{
        ref: string;
        show: string;
        date: string | null;
        qty: number;
        total: number; // pounds
        status: string;
        isLive: boolean;
      }>;
    };

    const byCustomer = new Map<string, CustomerAgg>();

    for (const o of orders) {
      const email = (o.email || o.user?.email || "").trim();
      if (!email) continue;

      const key = o.userId ? `user:${o.userId}` : `email:${email.toLowerCase()}`;

      const showTitle = o.show?.title || "Untitled show";
      const showDateIso = o.show?.date ? new Date(o.show.date).toISOString().slice(0, 10) : null;

      const qtyFromTickets = (o.tickets || []).reduce((sum, t) => sum + (t.quantity || 0), 0);
      const qty = (o.quantity != null ? o.quantity : qtyFromTickets) || 0;

      const totalPounds = (o.amountPence || 0) / 100;

      const isLive = o.show?.status === ShowStatus.LIVE;

      const orderItem = {
        ref: o.id, // real id (no fake ORD-####)
        show: showTitle,
        date: showDateIso,
        qty,
        total: totalPounds,
        status: String(o.status),
        isLive,
      };

      let agg = byCustomer.get(key);
      if (!agg) {
        const nameFromUser = (o.user?.name || "").trim();
        const fallbackName = nameFromUser || email || "Customer";

        agg = {
          id: o.userId || email,
          name: fallbackName,
          email: email,
          phone: null,
          totalOrders: 0,
          totalTickets: 0,
          totalSpend: 0,
          lastPurchase: null,
          showsBought: 0,
          lastShow: null,
          loyalty: "New",
          marketingConsent: null,
          notes: null,
          tags: [],
          orders: [],
        };

        byCustomer.set(key, agg);
      }

      agg.totalOrders += 1;
      agg.totalTickets += qty;
      agg.totalSpend += totalPounds;
      agg.orders.push(orderItem);

      // lastPurchase / lastShow based on most recent order we encounter (we sorted desc)
      if (!agg.lastPurchase) {
        // Prefer show date if available, else order createdAt
        const dt = o.show?.date ? new Date(o.show.date) : new Date(o.createdAt);
        agg.lastPurchase = dt.toISOString().slice(0, 10);
        agg.lastShow = showTitle;
      }
    }

    // Post-process: showsBought + loyalty + optional range filter
    let items = Array.from(byCustomer.values()).map((c) => {
      const uniqueShows = new Set(
        (c.orders || []).map((x) => x.show).filter(Boolean)
      );
      c.showsBought = uniqueShows.size;

      // Loyalty derived from real totals (no mock)
      if (c.totalOrders >= 5) c.loyalty = "VIP";
      else if (c.totalOrders >= 2) c.loyalty = "Repeat";
      else c.loyalty = "New";

      // Keep only most recent 50 orders in drawer for sanity (still real)
      c.orders = (c.orders || []).slice(0, 50);

      return c;
    });

    if (rangeDays != null) {
      items = items.filter((c) => {
        if (!c.lastPurchase) return true;
        const d = new Date(c.lastPurchase);
        if (Number.isNaN(d.getTime())) return true;
        const days = (now - d.getTime()) / dayMs;
        return days <= rangeDays;
      });
    }

    // Sort customers by last purchase desc (nulls last)
    items.sort((a, b) => {
      const ad = a.lastPurchase ? new Date(a.lastPurchase).getTime() : 0;
      const bd = b.lastPurchase ? new Date(b.lastPurchase).getTime() : 0;
      return bd - ad;
    });

    return res.json({ items });
  } catch (err: any) {
    console.error("[admin-customers] failed", err);
    return res.status(500).json({ error: err?.message || "Failed to load customers" });
  }
});

export default router;
