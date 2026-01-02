import { Router } from "express";
import prisma from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../utils/security.js";
import {
  clearCustomerCookie,
  readCustomerSession,
  setCustomerCookie,
  signCustomerToken,
} from "../lib/customer-auth.js";
import { clearStorefrontCart, readStorefrontCart } from "../lib/storefront-cart.js";

const router = Router();

async function ensureMembership(customerAccountId: string, storefrontSlug?: string | null) {
  if (!storefrontSlug) return null;
  const storefront = await prisma.storefront.findUnique({ where: { slug: storefrontSlug } });
  if (!storefront) return null;

  const existing = await prisma.customerStorefrontMembership.findFirst({
    where: { customerAccountId, storefrontId: storefront.id },
  });
  if (existing) return existing;

  return prisma.customerStorefrontMembership.create({
    data: { customerAccountId, storefrontId: storefront.id },
  });
}

async function mergeGuestCart(
  req: any,
  res: any,
  customerAccountId: string,
  storefrontSlug?: string | null
) {
  if (!storefrontSlug) return;
  const storefront = await prisma.storefront.findUnique({ where: { slug: storefrontSlug } });
  if (!storefront) return;

  const cart = readStorefrontCart(req, storefrontSlug);
  if (!cart.length) return;

  const basket = await prisma.basket.upsert({
    where: {
      customerAccountId_storefrontId: {
        customerAccountId,
        storefrontId: storefront.id,
      },
    },
    update: {},
    create: {
      customerAccountId,
      storefrontId: storefront.id,
    },
  });

  const existingItems = await prisma.basketItem.findMany({
    where: { basketId: basket.id },
    select: { id: true, productId: true, variantId: true, qty: true },
  });

  for (const item of cart) {
    const existing = existingItems.find(
      (entry) => entry.productId === item.productId && entry.variantId === (item.variantId ?? null)
    );

    if (existing) {
      await prisma.basketItem.update({
        where: { id: existing.id },
        data: { qty: existing.qty + item.qty },
      });
    } else {
      await prisma.basketItem.create({
        data: {
          basketId: basket.id,
          productId: item.productId,
          variantId: item.variantId ?? null,
          qty: item.qty,
          customAmountPence: item.customAmount ?? null,
        },
      });
    }
  }

  clearStorefrontCart(res, storefrontSlug);
}

function requireCustomer(req: any, res: any, next: any) {
  readCustomerSession(req)
    .then((session) => {
      if (!session?.sub) return res.status(401).json({ ok: false, error: "Not signed in" });
      req.customerSession = session;
      next();
    })
    .catch(() => res.status(401).json({ ok: false, error: "Not signed in" }));
}

router.post("/auth/signup", async (req, res) => {
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
        lastLoginAt: new Date(),
      },
      select: { id: true, email: true, name: true },
    });

    await ensureMembership(customer.id, storefrontSlug);
    await mergeGuestCart(req, res, customer.id, storefrontSlug);

    const token = await signCustomerToken({ id: customer.id, email: customer.email });
    setCustomerCookie(res, token);

    return res.status(201).json({ ok: true, customer });
  } catch (error: any) {
    console.error("public signup failed", error);
    return res.status(500).json({ ok: false, error: "Failed to create account" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const storefrontSlug = String(req.body?.storefrontSlug || "").trim() || null;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const customer = await prisma.customerAccount.findUnique({ where: { email } });
    if (!customer || !customer.passwordHash) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const ok = await verifyPassword(password, customer.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    await prisma.customerAccount.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    await ensureMembership(customer.id, storefrontSlug);
    await mergeGuestCart(req, res, customer.id, storefrontSlug);

    const token = await signCustomerToken({ id: customer.id, email: customer.email });
    setCustomerCookie(res, token);

    return res.json({ ok: true, customer: { id: customer.id, email: customer.email, name: customer.name } });
  } catch (error: any) {
    console.error("public login failed", error);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});

router.post("/auth/logout", (_req, res) => {
  clearCustomerCookie(res);
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
  let storefrontId: string | undefined;
  if (storefrontSlug) {
    const storefront = await prisma.storefront.findUnique({ where: { slug: storefrontSlug } });
    if (!storefront) return res.json({ ok: true, items: [] });
    storefrontId = storefront.id;
  }

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: String(req.customerSession.sub),
      ...(storefrontId ? { storefrontId } : {}),
    },
    include: {
      show: { select: { title: true, date: true, venue: { select: { name: true, city: true } } } },
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
      showTitle: order.show?.title || "Show",
      showDate: order.show?.date || null,
      venue: order.show?.venue || null,
      status: order.status,
    })),
  });
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

export default router;
