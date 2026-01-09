import { Router } from "express";
import {
  InventoryMode,
  Prisma,
  ProductCategory,
  ProductFulfilmentType,
  ProductOrderFulfilmentStatus,
  ProductOrderItemStatus,
  ProductOrderStatus,
  ProductOrderSource,
  ProductStatus,
} from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { ensureStorefrontForUser, ensureUniqueSlug, slugify } from "../lib/storefront.js";

const router = Router();

const productStatusValues = new Set(Object.values(ProductStatus));
const productCategoryValues = new Set(Object.values(ProductCategory));
const productFulfilmentValues = new Set(Object.values(ProductFulfilmentType));
const inventoryModeValues = new Set(Object.values(InventoryMode));

function requireUserId(req: any) {
  const id = req?.user?.id;
  if (!id) throw new Error("Auth middleware did not attach req.user");
  return String(id);
}

function isAdmin(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ADMIN";
}

async function loadStorefrontForRequest(req: any) {
  const ownerUserId = isAdmin(req)
    ? String(req.query.ownerUserId || req.body?.ownerUserId || req.user?.id || "")
    : requireUserId(req);

  if (!ownerUserId) {
    throw new Error("Missing owner user id");
  }

  const storefront = await prisma.storefront.findFirst({
    where: { ownerUserId },
  });

  return { storefront, ownerUserId };
}

function parseIntOrNull(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function normalizeEnumValue<T extends string>(value: any, allowed: Set<string>, fallback: T): T {
  const normalized = String(value || "").trim().toUpperCase();
  return (allowed.has(normalized) ? normalized : fallback) as T;
}

router.get("/product-store/storefront", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    return res.json({ ok: true, storefront });
  } catch (err: any) {
    console.error("[product-store] storefront fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load storefront" });
  }
});

router.post("/product-store/storefront", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront, ownerUserId } = await loadStorefrontForRequest(req);
    const payload = req.body || {};

    const name = String(payload.name || "").trim();
    const slugRaw = String(payload.slug || "").trim();
    const slugValue = slugRaw ? slugify(slugRaw) : "";
    const logoUrl = String(payload.logoUrl || "").trim() || null;

    if (!name) {
      return res.status(400).json({ ok: false, error: "Storefront name is required" });
    }

    if (!storefront) {
      const uniqueSlug = slugValue ? await ensureUniqueSlug(slugValue) : await ensureUniqueSlug(slugify(name));
      const created = await prisma.storefront.create({
        data: {
          ownerUserId,
          name,
          slug: uniqueSlug,
          status: payload.status || "DRAFT",
          logoUrl,
          brandColour: payload.brandColour || null,
          supportEmail: payload.supportEmail || null,
          policiesText: payload.policiesText || null,
          taxMode: payload.taxMode || "NONE",
          taxPercent: parseIntOrNull(payload.taxPercent),
          shippingEnabled: Boolean(payload.shippingEnabled),
          collectionEnabled: Boolean(payload.collectionEnabled),
          digitalEnabled: Boolean(payload.digitalEnabled),
          shippingFlatFeePence: parseIntOrNull(payload.shippingFlatFeePence),
        },
      });

      return res.json({ ok: true, storefront: created });
    }

    if (slugValue && slugValue !== storefront.slug) {
      const existing = await prisma.storefront.findUnique({ where: { slug: slugValue } });
      if (existing && existing.id !== storefront.id) {
        return res.status(409).json({ ok: false, error: "That storefront slug is already taken." });
      }
    }

    const updated = await prisma.storefront.update({
      where: { id: storefront.id },
      data: {
        name,
        slug: slugValue || storefront.slug,
        status: payload.status || storefront.status,
        logoUrl,
        brandColour: payload.brandColour || null,
        supportEmail: payload.supportEmail || null,
        policiesText: payload.policiesText || null,
        taxMode: payload.taxMode || storefront.taxMode,
        taxPercent: parseIntOrNull(payload.taxPercent),
        shippingEnabled: Boolean(payload.shippingEnabled),
        collectionEnabled: Boolean(payload.collectionEnabled),
        digitalEnabled: Boolean(payload.digitalEnabled),
        shippingFlatFeePence: parseIntOrNull(payload.shippingFlatFeePence),
      },
    });

    return res.json({ ok: true, storefront: updated });
  } catch (err: any) {
    console.error("[product-store] storefront update failed", err);
    return res.status(500).json({ ok: false, error: "Failed to save storefront" });
  }
});

router.get("/product-store/summary", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.json({ ok: true, summary: null });

    const [activeCount, draftCount, archivedCount] = await Promise.all([
      prisma.product.count({ where: { storefrontId: storefront.id, status: "ACTIVE" } }),
      prisma.product.count({ where: { storefrontId: storefront.id, status: "DRAFT" } }),
      prisma.product.count({ where: { storefrontId: storefront.id, status: "ARCHIVED" } }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const paidOrders = await prisma.productOrder.findMany({
      where: {
        storefrontId: storefront.id,
        status: ProductOrderStatus.PAID,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: { items: true },
    });

    const attachRateBase = paidOrders.length || 0;
    const attachRateWithAddon = paidOrders.filter((order) => order.items.length > 0).length;
    const attachRate = attachRateBase ? (attachRateWithAddon / attachRateBase) * 100 : 0;

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearAgo = new Date();
    yearAgo.setFullYear(now.getFullYear() - 1);

    const [rev7d, revMonth, revYear] = await Promise.all([
      prisma.productOrder.aggregate({
        where: { storefrontId: storefront.id, status: ProductOrderStatus.PAID, createdAt: { gte: sevenDaysAgo } },
        _sum: { totalPence: true },
      }),
      prisma.productOrder.aggregate({
        where: { storefrontId: storefront.id, status: ProductOrderStatus.PAID, createdAt: { gte: monthStart } },
        _sum: { totalPence: true },
      }),
      prisma.productOrder.aggregate({
        where: { storefrontId: storefront.id, status: ProductOrderStatus.PAID, createdAt: { gte: yearAgo } },
        _sum: { totalPence: true },
      }),
    ]);

    const topProducts = await prisma.productOrderItem.groupBy({
      by: ["productId"],
      where: { productOrder: { storefrontId: storefront.id, status: ProductOrderStatus.PAID } },
      _sum: { lineTotalPence: true, qty: true },
      orderBy: { _sum: { lineTotalPence: "desc" } },
      take: 5,
    });

    const topProductRows = await prisma.product.findMany({
      where: { id: { in: topProducts.map((row) => row.productId) } },
      select: { id: true, title: true },
    });

    const topProductMap = new Map(topProductRows.map((row) => [row.id, row.title]));

    const lowStock = await prisma.product.findMany({
      where: {
        storefrontId: storefront.id,
        inventoryMode: "TRACKED",
        lowStockThreshold: { not: null },
        stockCount: { not: null },
      },
    });

    const lowStockAlerts = lowStock.filter((product) =>
      typeof product.stockCount === "number" && typeof product.lowStockThreshold === "number"
        ? product.stockCount <= product.lowStockThreshold
        : false
    );

    return res.json({
      ok: true,
      summary: {
        storefront,
        counts: { active: activeCount, draft: draftCount, archived: archivedCount },
        attachRate,
        revenue: {
          last7Days: Number(rev7d?._sum?.totalPence || 0),
          thisMonth: Number(revMonth?._sum?.totalPence || 0),
          last52Weeks: Number(revYear?._sum?.totalPence || 0),
        },
        topProducts: topProducts.map((row) => ({
          productId: row.productId,
          title: topProductMap.get(row.productId) || "Unknown",
          revenuePence: Number(row._sum?.lineTotalPence || 0),
          qty: Number(row._sum?.qty || 0),
        })),
        lowStockAlerts: lowStockAlerts.map((product) => ({
          id: product.id,
          title: product.title,
          stockCount: product.stockCount,
          threshold: product.lowStockThreshold,
        })),
      },
    });
  } catch (err: any) {
    console.error("[product-store] summary fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load summary" });
  }
});

router.get("/product-store/products", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.json({ ok: true, products: [] });

    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "";
    const category = typeof req.query.category === "string" ? req.query.category.toUpperCase() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where: Prisma.ProductWhereInput = { storefrontId: storefront.id };
    if (status) where.status = status as ProductStatus;
    if (category) where.category = category as any;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: { variants: true, images: true },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ ok: true, products });
  } catch (err: any) {
    console.error("[product-store] products fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load products" });
  }
});

router.get("/product-store/products/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

    const product = await prisma.product.findFirst({
      where: { id: String(req.params.id), storefrontId: storefront.id },
      include: { variants: true, images: true },
    });

    if (!product) return res.status(404).json({ ok: false, error: "Product not found" });

    return res.json({ ok: true, product });
  } catch (err: any) {
    console.error("[product-store] product fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load product" });
  }
});

router.post("/product-store/products", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront, ownerUserId } = await loadStorefrontForRequest(req);
    const activeStorefront = storefront ?? (await ensureStorefrontForUser(ownerUserId));

    const payload = req.body || {};
    const title = String(payload.title || "").trim();
    if (!title) return res.status(400).json({ ok: false, error: "Title is required" });

    const slugValue = slugify(String(payload.slug || title));

    const existing = await prisma.product.findFirst({
      where: { storefrontId: activeStorefront.id, slug: slugValue },
    });
    if (existing) return res.status(409).json({ ok: false, error: "Product slug already exists" });

    const product = await prisma.product.create({
      data: {
        storefrontId: activeStorefront.id,
        title,
        slug: slugValue,
        description: payload.description || null,
        category: normalizeEnumValue(payload.category, productCategoryValues, "MERCH"),
        fulfilmentType: normalizeEnumValue(payload.fulfilmentType, productFulfilmentValues, "NONE"),
        status: normalizeEnumValue(payload.status, productStatusValues, "DRAFT"),
        pricePence: parseIntOrNull(payload.pricePence),
        currency: payload.currency || "gbp",
        allowCustomAmount: Boolean(payload.allowCustomAmount),
        inventoryMode: normalizeEnumValue(payload.inventoryMode, inventoryModeValues, "UNLIMITED"),
        stockCount: parseIntOrNull(payload.stockCount),
        lowStockThreshold: parseIntOrNull(payload.lowStockThreshold),
        preorderEnabled: Boolean(payload.preorderEnabled),
        preorderCloseAt: payload.preorderCloseAt ? new Date(payload.preorderCloseAt) : null,
        maxPerOrder: parseIntOrNull(payload.maxPerOrder),
        maxPerTicket: parseIntOrNull(payload.maxPerTicket),
      },
    });

    const variants = Array.isArray(payload.variants) ? payload.variants : [];
    const images = Array.isArray(payload.images) ? payload.images : [];

    if (variants.length) {
      await prisma.productVariant.createMany({
        data: variants.map((variant: any, index: number) => ({
          productId: product.id,
          title: String(variant.title || "").trim(),
          sku: variant.sku || null,
          pricePenceOverride: parseIntOrNull(variant.pricePenceOverride),
          stockCountOverride: parseIntOrNull(variant.stockCountOverride),
          sortOrder: Number(variant.sortOrder ?? index),
        })),
      });
    }

    if (images.length) {
      await prisma.productImage.createMany({
        data: images.map((img: any, index: number) => ({
          productId: product.id,
          url: String(img.url || "").trim(),
          sortOrder: Number(img.sortOrder ?? index),
        })),
      });
    }

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { variants: true, images: true },
    });

    return res.json({ ok: true, product: fullProduct });
  } catch (err: any) {
    console.error("[product-store] create product failed", err);
    return res.status(500).json({ ok: false, error: "Failed to create product" });
  }
});

router.put("/product-store/products/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

    const payload = req.body || {};
    const title = String(payload.title || "").trim();
    if (!title) return res.status(400).json({ ok: false, error: "Title is required" });

    const productId = String(req.params.id);
    const slugValue = slugify(String(payload.slug || title));

    const existing = await prisma.product.findFirst({
      where: { storefrontId: storefront.id, slug: slugValue, NOT: { id: productId } },
    });
    if (existing) return res.status(409).json({ ok: false, error: "Product slug already exists" });

    await prisma.product.update({
      where: { id: productId },
      data: {
        title,
        slug: slugValue,
        description: payload.description || null,
        category: normalizeEnumValue(payload.category, productCategoryValues, "MERCH"),
        fulfilmentType: normalizeEnumValue(payload.fulfilmentType, productFulfilmentValues, "NONE"),
        status: normalizeEnumValue(payload.status, productStatusValues, "DRAFT"),
        pricePence: parseIntOrNull(payload.pricePence),
        currency: payload.currency || "gbp",
        allowCustomAmount: Boolean(payload.allowCustomAmount),
        inventoryMode: normalizeEnumValue(payload.inventoryMode, inventoryModeValues, "UNLIMITED"),
        stockCount: parseIntOrNull(payload.stockCount),
        lowStockThreshold: parseIntOrNull(payload.lowStockThreshold),
        preorderEnabled: Boolean(payload.preorderEnabled),
        preorderCloseAt: payload.preorderCloseAt ? new Date(payload.preorderCloseAt) : null,
        maxPerOrder: parseIntOrNull(payload.maxPerOrder),
        maxPerTicket: parseIntOrNull(payload.maxPerTicket),
      },
    });

    const variants = Array.isArray(payload.variants) ? payload.variants : [];
    const images = Array.isArray(payload.images) ? payload.images : [];

    await prisma.productVariant.deleteMany({ where: { productId } });
    await prisma.productImage.deleteMany({ where: { productId } });

    if (variants.length) {
      await prisma.productVariant.createMany({
        data: variants.map((variant: any, index: number) => ({
          productId,
          title: String(variant.title || "").trim(),
          sku: variant.sku || null,
          pricePenceOverride: parseIntOrNull(variant.pricePenceOverride),
          stockCountOverride: parseIntOrNull(variant.stockCountOverride),
          sortOrder: Number(variant.sortOrder ?? index),
        })),
      });
    }

    if (images.length) {
      await prisma.productImage.createMany({
        data: images.map((img: any, index: number) => ({
          productId,
          url: String(img.url || "").trim(),
          sortOrder: Number(img.sortOrder ?? index),
        })),
      });
    }

    const fullProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true, images: true },
    });

    return res.json({ ok: true, product: fullProduct });
  } catch (err: any) {
    console.error("[product-store] update product failed", err);
    return res.status(500).json({ ok: false, error: "Failed to update product" });
  }
});

router.get("/product-store/orders", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.json({ ok: true, orders: [] });

    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "";
    const fulfilment = typeof req.query.fulfilment === "string" ? req.query.fulfilment.toUpperCase() : "";
    const source = typeof req.query.source === "string" ? req.query.source.toUpperCase() : "";

    const where: Prisma.ProductOrderWhereInput = { storefrontId: storefront.id };
    if (status) where.status = status as ProductOrderStatus;
    if (fulfilment) where.fulfilmentStatus = fulfilment as ProductOrderFulfilmentStatus;
    if (source) where.source = source as ProductOrderSource;

    const orders = await prisma.productOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ ok: true, orders });
  } catch (err: any) {
    console.error("[product-store] orders fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load orders" });
  }
});

router.get("/product-store/orders/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

    const order = await prisma.productOrder.findFirst({
      where: { id: String(req.params.id), storefrontId: storefront.id },
      include: { items: true, storefront: true },
    });

    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

    return res.json({ ok: true, order });
  } catch (err: any) {
    console.error("[product-store] order fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load order" });
  }
});

router.post("/product-store/orders/:id/fulfil", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

    const orderId = String(req.params.id);
    const payload = req.body || {};

    if (payload.itemId) {
      const metadata = payload.metadata || {};
      const trackingNumber = typeof metadata.trackingNumber === "string" ? metadata.trackingNumber.trim() : "";
      const trackingUrl = typeof metadata.trackingUrl === "string" ? metadata.trackingUrl.trim() : "";
      const trackingCarrier = typeof metadata.trackingCarrier === "string" ? metadata.trackingCarrier.trim() : "";

      await prisma.productOrderItem.update({
        where: { id: String(payload.itemId) },
        data: {
          fulfilmentStatus: payload.status || "FULFILLED",
          trackingNumber: trackingNumber || undefined,
          trackingUrl: trackingUrl || undefined,
          trackingCarrier: trackingCarrier || undefined,
          metadataJson: payload.metadata ? payload.metadata : undefined,
        },
      });
    } else if (payload.status) {
      await prisma.productOrder.update({
        where: { id: orderId },
        data: {
          fulfilmentStatus: payload.status,
        },
      });
    }

    const items = await prisma.productOrderItem.findMany({ where: { productOrderId: orderId } });
    let fulfilmentStatus: ProductOrderFulfilmentStatus;
    if (items.some((item) => item.fulfilmentStatus === ProductOrderItemStatus.ERROR)) {
      fulfilmentStatus = ProductOrderFulfilmentStatus.ERROR;
    } else {
      const fulfilled = items.filter((item) => item.fulfilmentStatus === ProductOrderItemStatus.FULFILLED).length;
      fulfilmentStatus =
        fulfilled === 0
          ? ProductOrderFulfilmentStatus.UNFULFILLED
          : fulfilled === items.length
            ? ProductOrderFulfilmentStatus.FULFILLED
            : ProductOrderFulfilmentStatus.PARTIAL;
    }

    await prisma.productOrder.update({
      where: { id: orderId },
      data: { fulfilmentStatus },
    });

    const order = await prisma.productOrder.findFirst({
      where: { id: orderId, storefrontId: storefront.id },
      include: { items: true },
    });

    return res.json({ ok: true, order });
  } catch (err: any) {
    console.error("[product-store] fulfil update failed", err);
    return res.status(500).json({ ok: false, error: "Failed to update fulfilment" });
  }
});

router.get("/product-store/upsells", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.json({ ok: true, rules: [] });

    const showId = typeof req.query.showId === "string" ? req.query.showId.trim() : "";

    const rules = await prisma.upsellRule.findMany({
      where: {
        storefrontId: storefront.id,
        ...(showId ? { showId } : {}),
      },
      include: { product: true, productVariant: true, ticketType: true, show: true },
      orderBy: { priority: "asc" },
    });

    return res.json({ ok: true, rules });
  } catch (err: any) {
    console.error("[product-store] upsell rules fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load upsell rules" });
  }
});

router.post("/product-store/upsells", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

    const payload = req.body || {};
    if (!payload.productId) return res.status(400).json({ ok: false, error: "Product is required" });

    const rule = await prisma.upsellRule.create({
      data: {
        storefrontId: storefront.id,
        productId: payload.productId,
        productVariantId: payload.productVariantId || null,
        showId: payload.showId || null,
        ticketTypeId: payload.ticketTypeId || null,
        priority: Number(payload.priority || 1),
        recommended: Boolean(payload.recommended),
        active: payload.active !== false,
        maxPerOrderOverride: parseIntOrNull(payload.maxPerOrderOverride),
        maxPerTicketOverride: parseIntOrNull(payload.maxPerTicketOverride),
      },
    });

    return res.json({ ok: true, rule });
  } catch (err: any) {
    console.error("[product-store] upsell rule create failed", err);
    return res.status(500).json({ ok: false, error: "Failed to create upsell rule" });
  }
});

router.put("/product-store/upsells/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.status(404).json({ ok: false, error: "Storefront not found" });

    const payload = req.body || {};

    const rule = await prisma.upsellRule.update({
      where: { id: String(req.params.id) },
      data: {
        priority: Number(payload.priority || 1),
        recommended: Boolean(payload.recommended),
        active: payload.active !== false,
        maxPerOrderOverride: parseIntOrNull(payload.maxPerOrderOverride),
        maxPerTicketOverride: parseIntOrNull(payload.maxPerTicketOverride),
        ticketTypeId: payload.ticketTypeId || null,
      },
    });

    return res.json({ ok: true, rule });
  } catch (err: any) {
    console.error("[product-store] upsell rule update failed", err);
    return res.status(500).json({ ok: false, error: "Failed to update upsell rule" });
  }
});

router.delete("/product-store/upsells/:id", requireAdminOrOrganiser, async (req, res) => {
  try {
    await prisma.upsellRule.delete({ where: { id: String(req.params.id) } });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[product-store] upsell rule delete failed", err);
    return res.status(500).json({ ok: false, error: "Failed to delete upsell rule" });
  }
});

router.get("/product-store/options", requireAdminOrOrganiser, async (req, res) => {
  try {
    const { storefront } = await loadStorefrontForRequest(req);
    if (!storefront) return res.json({ ok: true, shows: [], products: [] });

    const shows = await prisma.show.findMany({
      where: { organiserId: storefront.ownerUserId },
      select: { id: true, title: true, date: true, ticketTypes: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });

    const products = await prisma.product.findMany({
      where: { storefrontId: storefront.id, status: "ACTIVE" },
      include: { variants: true },
      orderBy: { title: "asc" },
    });

    return res.json({ ok: true, shows, products });
  } catch (err: any) {
    console.error("[product-store] options fetch failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load options" });
  }
});

export default router;
