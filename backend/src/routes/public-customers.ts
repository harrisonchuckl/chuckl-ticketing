import { Router } from "express";
import prisma from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../utils/security.js";
import {
  clearCustomerCookie,
  readCustomerSession,
  setCustomerCookie,
  signCustomerToken,
} from "../lib/customer-auth.js";
import { ensureMembership, linkPaidGuestOrders, mergeGuestCart, requireCustomer } from "../lib/public-customer.js";
import { publicAuthLimiter, requireSameOrigin } from "../lib/public-auth-guards.js";
import { readStorefrontCart } from "../lib/storefront-cart.js";
import { issueCustomerEmailVerification } from "../lib/customer-email-verification.js";
import { buildCustomerTicketsPdf, sendTicketsEmail } from "../services/email.js";
import { readConsent } from "../lib/auth/cookie.js";

const router = Router();

router.post("/auth/signup", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim() || null;
    const storefrontSlug = String(req.body?.storefrontSlug || "").trim() || null;
    const marketingConsent = Boolean(req.body?.marketingConsent || false);

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const existing = await prisma.customerAccount.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Account already exists" });
    }

    const passwordHash = await hashPassword(password);
    const customer = await prisma.customerAccount.create({
      data: {
        email,
        passwordHash,
        name,
        marketingConsent,
      },
      select: { id: true, email: true, name: true },
    });

    const storefront = storefrontSlug
      ? await prisma.storefront.findUnique({
          where: { slug: storefrontSlug },
          select: { ownerUserId: true, name: true },
        })
      : null;

    const storefrontName = storefront?.name || storefrontSlug || null;
    const verifyPath = storefrontSlug
      ? `/public/${encodeURIComponent(storefrontSlug)}/account/verify`
      : "/account/verify";
    await issueCustomerEmailVerification({
      customerId: customer.id,
      email: customer.email,
      req,
      verifyPath,
      storefrontName,
    });

    console.info("public signup", { customerId: customer.id, storefrontSlug });
    return res.status(201).json({
      ok: true,
      customer,
      requiresVerification: true,
      message: "Check your email to verify your account before signing in.",
    });
  } catch (error: any) {
    console.error("public signup failed", error);
    return res.status(500).json({ ok: false, error: "Failed to create account" });
  }
});

router.post("/auth/login", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const storefrontSlug = String(req.body?.storefrontSlug || "").trim() || null;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const customer = await prisma.customerAccount.findUnique({ where: { email } });
    if (!customer || !customer.passwordHash) {
      console.warn("public login failed", { storefrontSlug, reason: "missing_account" });
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const ok = await verifyPassword(password, customer.passwordHash);
    if (!ok) {
      console.warn("public login failed", { storefrontSlug, reason: "invalid_password" });
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    if (!customer.emailVerifiedAt) {
      const storefront = storefrontSlug
        ? await prisma.storefront.findUnique({ where: { slug: storefrontSlug }, select: { name: true } })
        : null;
      const storefrontName = storefront?.name || storefrontSlug || null;
      const verifyPath = storefrontSlug
        ? `/public/${encodeURIComponent(storefrontSlug)}/account/verify`
        : "/account/verify";
      await issueCustomerEmailVerification({
        customerId: customer.id,
        email: customer.email,
        req,
        verifyPath,
        storefrontName,
      });
      return res.status(403).json({
        ok: false,
        error: "Please verify your email to continue. We've sent you a new verification link.",
      });
    }

    await prisma.customerAccount.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    let organiserId: string | null = null;
    if (storefrontSlug) {
      const storefront = await prisma.storefront.findUnique({
        where: { slug: storefrontSlug },
        select: { ownerUserId: true },
      });
      organiserId = storefront?.ownerUserId || null;
      if (!organiserId) {
        const organiser = await prisma.user.findUnique({
          where: { storefrontSlug },
          select: { id: true },
        });
        organiserId = organiser?.id || null;
      }
    }

    await ensureMembership(customer.id, storefrontSlug);
    await linkPaidGuestOrders(customer.id, customer.email, organiserId);
    await mergeGuestCart(req, res, customer.id, storefrontSlug);

    const token = await signCustomerToken({ id: customer.id, email: customer.email });
    setCustomerCookie(res, token);

    console.info("public login", { customerId: customer.id, storefrontSlug });
    return res.json({ ok: true, customer: { id: customer.id, email: customer.email, name: customer.name } });
  } catch (error: any) {
    console.error("public login failed", error);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});


router.post("/auth/logout", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  const session = await readCustomerSession(req);
  clearCustomerCookie(res);
  if (session?.sub) {
    console.info("public logout", { customerId: session.sub });
  }
  res.json({ ok: true });
});

router.get("/auth/session", async (req, res) => {
  const session = await readCustomerSession(req);
  if (!session?.sub) return res.json({ ok: false });

  const customer = await prisma.customerAccount.findUnique({
    where: { id: String(session.sub) },
    select: { id: true, email: true, name: true, phone: true, marketingConsent: true },
  });

  if (!customer) return res.json({ ok: false });

  const storefrontSlug = String(req.query?.storefront || "").trim() || null;
  let membership = null;
  if (storefrontSlug) {
    const storefront = await prisma.storefront.findUnique({ where: { slug: storefrontSlug } });
    if (storefront) {
      membership = await prisma.customerStorefrontMembership.findFirst({
        where: { customerAccountId: customer.id, storefrontId: storefront.id },
        select: { id: true, marketingOptIn: true },
      });
    }
  }

  return res.json({ ok: true, customer, membership });
});

router.get("/customer/orders", requireCustomer, async (req: any, res) => {
  const storefrontSlug = String(req.query?.storefront || "").trim() || null;
  const { storefrontId, organiserId } = await resolveStorefrontContext(storefrontSlug);

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: String(req.customerSession.sub),
      ...buildOrderScope(storefrontSlug, storefrontId, organiserId),
    },
    include: {
      show: { select: { title: true, date: true, venue: { select: { name: true, city: true } } } },
      _count: { select: { tickets: true, productOrders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return res.json({
    ok: true,
    items: orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      amountPence: order.amountPence,
      ticketsCount: order._count.tickets,
      productOrdersCount: order._count.productOrders,
      showTitle: order.show?.title || "Show",
      showDate: order.show?.date || null,
      venue: order.show?.venue || null,
      status: order.status,
    })),
  });
});

router.get("/customer/tickets", requireCustomer, async (req: any, res) => {
  const storefrontSlug = String(req.query?.storefront || "").trim() || null;
  const { storefrontId, organiserId } = await resolveStorefrontContext(storefrontSlug);

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: String(req.customerSession.sub),
      ...buildOrderScope(storefrontSlug, storefrontId, organiserId),
    },
    include: {
      show: {
        select: {
          title: true,
          date: true,
          venue: { select: { name: true, city: true, county: true } },
        },
      },
      tickets: {
        include: {
          ticketType: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const items = orders.map((order) => ({
    orderId: order.id,
    createdAt: order.createdAt,
    showTitle: order.show?.title || "Show",
    showDate: order.show?.date || null,
    venue: order.show?.venue || null,
    status: order.status,
    pdfUrl: storefrontSlug
      ? `/public/customer/orders/${encodeURIComponent(order.id)}/tickets.pdf?storefront=${encodeURIComponent(
          storefrontSlug
        )}`
      : `/public/customer/orders/${encodeURIComponent(order.id)}/tickets.pdf`,
    tickets: (order.tickets || []).map((ticket) => ({
      id: ticket.id,
      serial: ticket.serial,
      status: ticket.status,
      seatRef: ticket.seatRef,
      holderName: ticket.holderName,
      ticketType: ticket.ticketType?.name || null,
    })),
  }));

  return res.json({ ok: true, items });
});

router.get("/customer/products", requireCustomer, async (req: any, res) => {
  const storefrontSlug = String(req.query?.storefront || "").trim() || null;
  const { storefrontId } = await resolveStorefrontContext(storefrontSlug);

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: String(req.customerSession.sub),
      containsProducts: true,
      ...(storefrontId ? { storefrontId } : {}),
    },
    include: {
      productOrders: {
        include: {
          items: {
            include: {
              product: { select: { title: true } },
              variant: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const items = orders.flatMap((order) =>
    (order.productOrders || []).map((productOrder) => ({
      orderId: order.id,
      createdAt: order.createdAt,
      status: productOrder.status,
      fulfilmentStatus: productOrder.fulfilmentStatus,
      totalPence: productOrder.totalPence,
      items: productOrder.items.map((item) => ({
        id: item.id,
        title: item.titleSnapshot || item.product?.title || "Product",
        variant: item.variantSnapshot || item.variant?.title || null,
        qty: item.qty,
        unitPricePence: item.unitPricePence,
        lineTotalPence: item.lineTotalPence,
        fulfilmentType: item.fulfilmentTypeSnapshot,
        fulfilmentStatus: item.fulfilmentStatus,
        trackingNumber: item.trackingNumber,
        trackingUrl: item.trackingUrl,
        trackingCarrier: item.trackingCarrier,
      })),
    }))
  );

  return res.json({ ok: true, items });
});

router.get("/customer/recommendations", requireCustomer, async (req: any, res) => {
  const consent = readConsent(req);
  if (!consent.personalisation) {
    return res.status(403).json({ ok: false, error: "Personalisation consent required" });
  }

  const storefrontSlug = String(req.query?.storefront || "").trim() || null;
  const { organiserId } = await resolveStorefrontContext(storefrontSlug);

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: String(req.customerSession.sub),
      status: "PAID",
      ...(organiserId ? { show: { organiserId } } : {}),
    },
    select: {
      show: {
        select: {
          id: true,
          organiserId: true,
          eventType: true,
          venue: { select: { county: true } },
        },
      },
    },
  });

  const purchasedShowIds = new Set<string>();
  const organiserIds = new Set<string>();
  const eventTypes = new Set<string>();
  const counties = new Set<string>();

  for (const order of orders) {
    const show = order.show;
    if (!show) continue;
    purchasedShowIds.add(show.id);
    if (show.organiserId) organiserIds.add(show.organiserId);
    if (show.eventType) eventTypes.add(show.eventType);
    if (show.venue?.county) counties.add(show.venue.county);
  }

  if (!organiserIds.size || !eventTypes.size || !counties.size) {
    return res.json({ ok: true, items: [] });
  }

  const recommendations = await prisma.show.findMany({
    where: {
      status: "LIVE",
      date: { gte: new Date() },
      organiserId: { in: Array.from(organiserIds) },
      eventType: { in: Array.from(eventTypes) },
      venue: { county: { in: Array.from(counties) } },
      id: { notIn: Array.from(purchasedShowIds) },
    },
    select: {
      id: true,
      title: true,
      date: true,
      eventType: true,
      venue: { select: { name: true, city: true, county: true } },
    },
    orderBy: { date: "asc" },
    take: 6,
  });

  return res.json({
    ok: true,
    items: recommendations.map((show) => ({
      id: show.id,
      title: show.title || "Untitled show",
      date: show.date,
      eventType: show.eventType,
      venue: show.venue || null,
    })),
  });
});

router.get("/customer/orders/:orderId/tickets.pdf", requireCustomer, async (req: any, res) => {
  const storefrontSlug = String(req.query?.storefront || "").trim() || null;
  const { storefrontId, organiserId } = await resolveStorefrontContext(storefrontSlug);
  const orderId = String(req.params.orderId || "");
  if (!orderId) return res.status(400).json({ ok: false, error: "Order ID is required" });

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerAccountId: String(req.customerSession.sub),
      ...buildOrderScope(storefrontSlug, storefrontId, organiserId),
    },
    select: { id: true },
  });

  if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

  const pdfResult = await buildCustomerTicketsPdf(order.id);
  if (!pdfResult) return res.status(404).json({ ok: false, error: "Tickets PDF unavailable" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="tixall-tickets-${encodeURIComponent(pdfResult.orderRef)}.pdf"`
  );
  return res.send(pdfResult.pdf);
});

router.post("/customer/orders/:orderId/resend", requireCustomer, async (req: any, res) => {
  const storefrontSlug = String(req.query?.storefront || "").trim() || null;
  const { storefrontId, organiserId } = await resolveStorefrontContext(storefrontSlug);
  const orderId = String(req.params.orderId || "");
  if (!orderId) return res.status(400).json({ ok: false, error: "Order ID is required" });

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerAccountId: String(req.customerSession.sub),
      ...buildOrderScope(storefrontSlug, storefrontId, organiserId),
    },
    select: { id: true },
  });

  if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

  const result = await sendTicketsEmail(order.id);
  return res.json({ ok: result.ok, message: result.message || undefined });
});

router.patch("/customer/profile", requireCustomer, async (req: any, res) => {
  const name = String(req.body?.name || "").trim() || null;
  const phone = String(req.body?.phone || "").trim() || null;
  const marketingConsent = req.body?.marketingConsent;

  const updated = await prisma.customerAccount.update({
    where: { id: String(req.customerSession.sub) },
    data: {
      name,
      phone,
      ...(typeof marketingConsent === "boolean" ? { marketingConsent } : {}),
    },
    select: { id: true, name: true, phone: true, marketingConsent: true },
  });

  res.json({ ok: true, customer: updated });
});

router.patch("/customer/membership", requireCustomer, async (req: any, res) => {
  const storefrontSlug = String(req.query?.storefront || "").trim();
  if (!storefrontSlug) return res.status(400).json({ ok: false, error: "storefront required" });

  const storefront = await prisma.storefront.findUnique({ where: { slug: storefrontSlug } });
  if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

  const marketingOptIn = Boolean(req.body?.marketingOptIn);

  const membership = await prisma.customerStorefrontMembership.upsert({
    where: {
      customerAccountId_storefrontId: {
        customerAccountId: String(req.customerSession.sub),
        storefrontId: storefront.id,
      },
    },
    update: { marketingOptIn },
    create: {
      customerAccountId: String(req.customerSession.sub),
      storefrontId: storefront.id,
      marketingOptIn,
    },
    select: { id: true, marketingOptIn: true },
  });

  res.json({ ok: true, membership });
});

router.get("/basket", async (req, res) => {
  const storefrontSlug = String(req.query?.storefront || "").trim();
  if (!storefrontSlug) {
    return res.status(400).json({ ok: false, error: "storefront required" });
  }

  const storefront = await prisma.storefront.findUnique({ where: { slug: storefrontSlug } });
  if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

  const session = await readCustomerSession(req);
  if (session?.sub) {
    await mergeGuestCart(req, res, String(session.sub), storefrontSlug);
    const basket = await prisma.basket.findFirst({
      where: { customerAccountId: String(session.sub), storefrontId: storefront.id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    const items = (basket?.items || []).map((item) => {
      const product = item.product;
      const variant = item.variant;
      const price = item.customAmountPence ?? variant?.pricePenceOverride ?? product?.pricePence ?? 0;
      return {
        id: item.id,
        title: product?.title || "Item",
        variant: variant?.title || null,
        qty: item.qty,
        unitPricePence: price,
        lineTotalPence: price * item.qty,
      };
    });

    return res.json({ ok: true, items });
  }

  const cart = readStorefrontCart(req, storefrontSlug);
  const productIds = Array.from(new Set(cart.map((item) => item.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true },
  });

  const items = cart.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const price = item.customAmount ?? variant?.pricePenceOverride ?? product?.pricePence ?? 0;
    return {
      id: `${item.productId}-${item.variantId || ""}`,
      title: product?.title || "Item",
      variant: variant?.title || null,
      qty: item.qty,
      unitPricePence: price,
      lineTotalPence: price * item.qty,
    };
  });

  return res.json({ ok: true, items });
});

async function resolveStorefrontContext(storefrontSlug: string | null) {
  let storefrontId: string | undefined;
  let organiserId: string | undefined;
  if (storefrontSlug) {
    const storefront = await prisma.storefront.findUnique({
      where: { slug: storefrontSlug },
      select: { id: true, ownerUserId: true },
    });
    if (storefront) {
      storefrontId = storefront.id;
      organiserId = storefront.ownerUserId;
    } else {
      const organiser = await prisma.user.findUnique({
        where: { storefrontSlug },
        select: { id: true },
      });
      organiserId = organiser?.id;
    }
  }
  return { storefrontId, organiserId };
}

function buildOrderScope(
  storefrontSlug: string | null,
  storefrontId?: string,
  organiserId?: string
) {
  if (!storefrontSlug) return {};
  if (storefrontId) {
    return {
      OR: [
        { storefrontId },
        ...(organiserId ? [{ storefrontId: null, show: { organiserId } }] : []),
      ],
    };
  }
  if (organiserId) {
    return { show: { organiserId } };
  }
  return {};
}

export default router;
