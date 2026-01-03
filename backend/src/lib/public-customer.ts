import prisma from "./prisma.js";
import { readCustomerSession } from "./customer-auth.js";
import { clearStorefrontCart, readStorefrontCart } from "./storefront-cart.js";

export async function ensureMembership(customerAccountId: string, storefrontSlug?: string | null) {
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

export async function mergeGuestCart(
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

export async function linkPaidGuestOrders(
  customerAccountId: string,
  email: string,
  organiserId?: string | null
) {
  const normalisedEmail = String(email || "").trim().toLowerCase();
  if (!normalisedEmail) return;

  await prisma.order.updateMany({
    where: {
      status: "PAID",
      OR: [
        { email: { equals: normalisedEmail, mode: "insensitive" } },
        { shippingEmail: { equals: normalisedEmail, mode: "insensitive" } },
      ],
      customerAccountId: null,
      ...(organiserId ? { show: { organiserId } } : {}),
    },
    data: { customerAccountId },
  });
}

export function requireCustomer(req: any, res: any, next: any) {
  readCustomerSession(req)
    .then((session) => {
      if (!session?.sub) return res.status(401).json({ ok: false, error: "Not signed in" });
      req.customerSession = session;
      next();
    })
    .catch(() => res.status(401).json({ ok: false, error: "Not signed in" }));
}
