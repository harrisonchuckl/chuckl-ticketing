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

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: String(req.customerSession.sub),
      ...(storefrontSlug
        ? storefrontId
          ? {
              OR: [
                { storefrontId },
                ...(organiserId ? [{ storefrontId: null, show: { organiserId } }] : []),
              ],
            }
          : organiserId
          ? { show: { organiserId } }
          : {}
        : {}),
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
