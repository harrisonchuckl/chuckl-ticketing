import { Router } from "express";
import prisma from "../lib/prisma.js";
import Stripe from "stripe";
import { slugify } from "../lib/storefront.js";

const router = Router();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const StripeClient = (Stripe as any)?.default || Stripe;
const stripe: Stripe | null = stripeSecret
  ? new StripeClient(stripeSecret, { apiVersion: "2024-06-20" })
  : null;

function esc(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(value: any) {
  return esc(value).replace(/"/g, "&quot;");
}

function money(pence: number | null | undefined) {
  return "£" + (Number(pence || 0) / 100).toFixed(2);
}

function getCartKey(slug: string) {
  return `storefront_cart_${slug}`;
}

function readCart(req: any, slug: string): Array<{ productId: string; variantId?: string | null; qty: number; customAmount?: number | null }> {
  const raw = req.cookies?.[getCartKey(slug)];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: String(item.productId || ""),
        variantId: item.variantId ? String(item.variantId) : null,
        qty: Math.max(1, Number(item.qty || 1)),
        customAmount: item.customAmount ? Number(item.customAmount) : null,
      }))
      .filter((item) => item.productId);
  } catch {
    return [];
  }
}

function writeCart(res: any, slug: string, cart: any[]) {
  res.cookie(getCartKey(slug), JSON.stringify(cart), {
    httpOnly: true,
    sameSite: "lax",
  });
}

router.get("/store/:storeSlug", async (req, res) => {
  const storeSlug = String(req.params.storeSlug || "");
  const storefront = await prisma.storefront.findUnique({
    where: { slug: storeSlug },
  });

  if (!storefront) return res.status(404).send("Store not found");

  const products = await prisma.product.findMany({
    where: { storefrontId: storefront.id, status: "ACTIVE" },
    include: { images: true },
    orderBy: { title: "asc" },
  });

  const cards = products
    .map((product) => {
      const image = product.images.sort((a, b) => a.sortOrder - b.sortOrder)[0];
      return `
        <a class="card" href="/store/${escAttr(storeSlug)}/products/${escAttr(product.slug)}">
          ${image ? `<img src="${escAttr(image.url)}" alt="${escAttr(product.title)}" />` : ""}
          <div class="title">${esc(product.title)}</div>
          <div class="muted">${product.allowCustomAmount ? "Choose amount" : money(product.pricePence)}</div>
        </a>
      `;
    })
    .join("");

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(storefront.name)} Store</title>
  <style>
    body { font-family: Inter, sans-serif; background:#f3f4f6; margin:0; }
    header { padding:24px; background:#fff; border-bottom:1px solid #e5e7eb; }
    .wrap { max-width:1100px; margin:0 auto; padding:24px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:16px; }
    .card { background:#fff; border-radius:12px; padding:16px; text-decoration:none; color:#111; box-shadow:0 1px 2px rgba(0,0,0,0.06); }
    .card img { width:100%; height:160px; object-fit:cover; border-radius:8px; }
    .muted { color:#6b7280; font-size:0.9rem; }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>${esc(storefront.name)}</h1>
      <p class="muted">${esc(storefront.policiesText || "")}</p>
    </div>
  </header>
  <div class="wrap">
    <div class="grid">${cards || "<p>No products yet.</p>"}</div>
  </div>
</body>
</html>`);
});

router.get("/store/:storeSlug/products/:productSlug", async (req, res) => {
  const storeSlug = String(req.params.storeSlug || "");
  const productSlug = String(req.params.productSlug || "");

  const storefront = await prisma.storefront.findUnique({ where: { slug: storeSlug } });
  if (!storefront) return res.status(404).send("Store not found");

  const product = await prisma.product.findFirst({
    where: { storefrontId: storefront.id, slug: productSlug, status: "ACTIVE" },
    include: { variants: true, images: true },
  });

  if (!product) return res.status(404).send("Product not found");

  const variantOptions = product.variants
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((variant) => `
      <option value="${escAttr(variant.id)}">${esc(variant.title)}</option>
    `)
    .join("");

  const image = product.images.sort((a, b) => a.sortOrder - b.sortOrder)[0];

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(product.title)}</title>
  <style>
    body { font-family: Inter, sans-serif; background:#f3f4f6; margin:0; }
    header { padding:24px; background:#fff; border-bottom:1px solid #e5e7eb; }
    .wrap { max-width:900px; margin:0 auto; padding:24px; }
    .card { background:#fff; border-radius:12px; padding:24px; }
    img { width:100%; border-radius:12px; margin-bottom:16px; }
    .btn { background:#111827; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; }
    .row { display:flex; gap:12px; flex-wrap:wrap; }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <a href="/store/${escAttr(storeSlug)}">Back to store</a>
    </div>
  </header>
  <div class="wrap">
    <div class="card">
      ${image ? `<img src="${escAttr(image.url)}" alt="${escAttr(product.title)}" />` : ""}
      <h1>${esc(product.title)}</h1>
      <p>${esc(product.description || "")}</p>
      <p><strong>${product.allowCustomAmount ? "Choose amount" : money(product.pricePence)}</strong></p>
      <form method="post" action="/store/${escAttr(storeSlug)}/cart/add">
        <input type="hidden" name="productId" value="${escAttr(product.id)}" />
        ${variantOptions ? `<label>Variant <select name="variantId">${variantOptions}</select></label>` : ""}
        ${product.allowCustomAmount ? `<label>Amount (pence) <input type="number" name="customAmount" min="100" /></label>` : ""}
        <label>Qty <input type="number" name="qty" min="1" value="1" /></label>
        <div class="row" style="margin-top:16px;">
          <button class="btn" type="submit">Add to cart</button>
          <a class="btn" href="/store/${escAttr(storeSlug)}/cart">View cart</a>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`);
});

router.post("/store/:storeSlug/cart/add", async (req, res) => {
  const storeSlug = String(req.params.storeSlug || "");
  const productId = String(req.body.productId || "");
  const variantId = req.body.variantId ? String(req.body.variantId) : null;
  const qty = Math.max(1, Number(req.body.qty || 1));
  const customAmount = req.body.customAmount ? Number(req.body.customAmount) : null;

  if (!productId) return res.status(400).send("Missing product");

  const cart = readCart(req, storeSlug);
  const existing = cart.find((item) => item.productId === productId && item.variantId === variantId);
  if (existing) {
    existing.qty += qty;
    if (customAmount) existing.customAmount = customAmount;
  } else {
    cart.push({ productId, variantId, qty, customAmount });
  }

  writeCart(res, storeSlug, cart);
  return res.redirect(`/store/${encodeURIComponent(storeSlug)}/cart`);
});

router.get("/store/:storeSlug/cart", async (req, res) => {
  const storeSlug = String(req.params.storeSlug || "");
  const cart = readCart(req, storeSlug);

  const storefront = await prisma.storefront.findUnique({ where: { slug: storeSlug } });
  if (!storefront) return res.status(404).send("Store not found");

  const productIds = cart.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const rows = cart
    .map((item, index) => {
      const product = productMap.get(item.productId);
      if (!product) return "";
      const variant = product.variants.find((v) => v.id === item.variantId);
      const unit = product.allowCustomAmount && item.customAmount
        ? item.customAmount
        : (variant?.pricePenceOverride ?? product.pricePence ?? 0);
      return `
        <div class="row">
          <div>
            <strong>${esc(product.title)}</strong>
            ${variant ? `<div class="muted">${esc(variant.title)}</div>` : ""}
          </div>
          <div>${money(unit)}</div>
          <div>
            <input type="number" name="qty_${index}" value="${item.qty}" min="1" />
            <input type="hidden" name="productId_${index}" value="${escAttr(item.productId)}" />
            <input type="hidden" name="variantId_${index}" value="${escAttr(item.variantId || "")}" />
            <input type="hidden" name="customAmount_${index}" value="${escAttr(item.customAmount || "")}" />
          </div>
        </div>
      `;
    })
    .join("");

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cart</title>
  <style>
    body { font-family: Inter, sans-serif; background:#f3f4f6; margin:0; }
    .wrap { max-width:900px; margin:0 auto; padding:24px; }
    .card { background:#fff; border-radius:12px; padding:24px; }
    .row { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #e5e7eb; }
    .muted { color:#6b7280; font-size:0.9rem; }
    .btn { background:#111827; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Your cart</h1>
    <div class="card">
      <form method="post" action="/store/${escAttr(storeSlug)}/cart/update">
        ${rows || "<p>No items yet.</p>"}
        <input type="hidden" name="count" value="${cart.length}" />
        <div style="margin-top:16px; display:flex; gap:12px;">
          <button class="btn" type="submit">Update cart</button>
          <button class="btn" formaction="/store/${escAttr(storeSlug)}/checkout" type="submit">Checkout</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`);
});

router.post("/store/:storeSlug/cart/update", (req, res) => {
  const storeSlug = String(req.params.storeSlug || "");
  const count = Math.max(0, Number(req.body.count || 0));
  const updated: Array<{ productId: string; variantId?: string | null; qty: number }> = [];

  for (let i = 0; i < count; i += 1) {
    const productId = String(req.body[`productId_${i}`] || "");
    const variantId = String(req.body[`variantId_${i}`] || "");
    const qty = Math.max(1, Number(req.body[`qty_${i}`] || 1));
    const customAmountRaw = req.body[`customAmount_${i}`];
    const customAmount = customAmountRaw ? Number(customAmountRaw) : null;
    if (productId) updated.push({ productId, variantId: variantId || null, qty, customAmount });
  }

  writeCart(res, storeSlug, updated);
  return res.redirect(`/store/${encodeURIComponent(storeSlug)}/cart`);
});

router.post("/store/:storeSlug/checkout", async (req, res) => {
  try {
    if (!stripe) return res.status(500).send("Stripe is not configured");
    const storeSlug = String(req.params.storeSlug || "");
    const cart = readCart(req, storeSlug);

    const storefront = await prisma.storefront.findUnique({ where: { slug: storeSlug } });
    if (!storefront) return res.status(404).send("Store not found");

    if (!cart.length) return res.redirect(`/store/${encodeURIComponent(storeSlug)}/cart`);

    const products = await prisma.product.findMany({
      where: { id: { in: cart.map((item) => item.productId) } },
      include: { variants: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    let requiresShipping = false;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const selections: any[] = [];

    for (const item of cart) {
      const product = productMap.get(item.productId);
      if (!product || product.status !== "ACTIVE") continue;
      const variant = product.variants.find((v) => v.id === item.variantId);
      const unitAmount = product.allowCustomAmount && item.customAmount
        ? item.customAmount
        : (variant?.pricePenceOverride ?? product.pricePence ?? 0);
      const qty = Math.max(1, item.qty);

      if (product.inventoryMode === "TRACKED") {
        const stock = variant?.stockCountOverride ?? product.stockCount ?? 0;
        if (stock < qty) {
          return res.status(409).send(`Insufficient stock for ${product.title}`);
        }
      }

      subtotal += unitAmount * qty;
      if (product.fulfilmentType === "SHIPPING") requiresShipping = true;

      selections.push({
        productId: product.id,
        variantId: variant?.id || null,
        qty,
        unitAmount,
        customAmount: product.allowCustomAmount ? unitAmount : null,
      });

      lineItems.push({
        quantity: qty,
        price_data: {
          currency: product.currency || "gbp",
          unit_amount: unitAmount,
          product_data: {
            name: product.title,
            metadata: {
              productId: product.id,
              variantId: variant?.id || "",
            },
          },
        },
      });
    }

    let taxPence = 0;
    if (storefront.taxMode !== "NONE" && storefront.taxPercent) {
      taxPence = Math.round((subtotal * storefront.taxPercent) / 100);
      if (taxPence > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: taxPence,
            product_data: { name: "Tax" },
          },
        });
      }
    }

    let shippingPence = 0;
    if (requiresShipping && storefront.shippingFlatFeePence) {
      shippingPence = storefront.shippingFlatFeePence;
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: shippingPence,
          product_data: { name: "Shipping" },
        },
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${baseUrl}/store/${encodeURIComponent(storeSlug)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/store/${encodeURIComponent(storeSlug)}/cart`,
      billing_address_collection: "required",
      shipping_address_collection: requiresShipping
        ? { allowed_countries: ["GB"] }
        : undefined,
      metadata: {
        storefrontId: storefront.id,
        source: "STOREFRONT_ONLY",
        productSelection: JSON.stringify(selections).slice(0, 4500),
        productTaxPence: String(taxPence || 0),
        productShippingPence: String(shippingPence || 0),
      },
    });

    console.debug("[storefront] stripe checkout session (RAW):", session);

    writeCart(res, storeSlug, []);
    return res.redirect(303, session.url || `/store/${encodeURIComponent(storeSlug)}/cart`);
  } catch (err: any) {
    console.error("[storefront] checkout failed", err);
    return res.status(500).send("Checkout failed");
  }
});

router.get("/store/:storeSlug/checkout/success", async (req, res) => {
  const storeSlug = String(req.params.storeSlug || "");
  const sessionId = String(req.query.session_id || "");

  const storefront = await prisma.storefront.findUnique({ where: { slug: storeSlug } });
  if (!storefront) return res.status(404).send("Store not found");

  const order = sessionId
    ? await prisma.productOrder.findFirst({
        where: { stripeCheckoutSessionId: sessionId, storefrontId: storefront.id },
      })
    : null;

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Order complete</title>
</head>
<body>
  <div style="max-width:720px; margin:40px auto; font-family:Inter, sans-serif;">
    <h1>Thanks for your order!</h1>
    <p>${order ? `Order reference: ${esc(order.id)}` : "Your payment has been received."}</p>
    <a href="/store/${escAttr(storeSlug)}">Back to store</a>
  </div>
</body>
</html>`);
});

router.post("/storefront/slug", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });
  const slug = slugify(name);
  const existing = await prisma.storefront.findUnique({ where: { slug } });
  if (existing) return res.json({ ok: true, slug: `${slug}-1` });
  return res.json({ ok: true, slug });
});

export default router;
