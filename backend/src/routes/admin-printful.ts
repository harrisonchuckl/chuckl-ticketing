import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { encryptToken } from "../lib/token-crypto.js";
import { createPrintfulClient } from "../services/integrations/printful.js";
import { slugify } from "../lib/storefront.js";

const router = Router();

const STATE_COOKIE = "printful_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;
const PRINTFUL_AUTHORIZE_URL = "https://www.printful.com/oauth/authorize";
const PRINTFUL_TOKEN_URL = "https://www.printful.com/oauth/token";
const JWT_SECRET = String(process.env.JWT_SECRET || "dev-secret");

function isAdmin(req: any) {
  return String(req.user?.role || "").toUpperCase() === "ADMIN";
}

function resolveOrganiserId(req: any) {
  if (isAdmin(req)) {
    return String(req.query.organiserId || req.body?.organiserId || req.user?.id || "");
  }
  return String(req.user?.id || "");
}

function isSecureCookie(req: any) {
  const xfProto = String(req.headers["x-forwarded-proto"] || "");
  return process.env.NODE_ENV === "production" || xfProto.includes("https");
}

function parsePriceToPence(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function collectImageUrls(payload: {
  sync_product?: { thumbnail_url?: string; files?: Array<{ preview_url?: string; url?: string }> };
  sync_variants?: Array<{ files?: Array<{ preview_url?: string; url?: string }> }>;
}) {
  const urls: string[] = [];
  if (payload.sync_product?.thumbnail_url) {
    urls.push(payload.sync_product.thumbnail_url);
  }
  (payload.sync_product?.files || []).forEach((file) => {
    if (file.preview_url) urls.push(file.preview_url);
    else if (file.url) urls.push(file.url);
  });
  (payload.sync_variants || []).forEach((variant) => {
    (variant.files || []).forEach((file) => {
      if (file.preview_url) urls.push(file.preview_url);
      else if (file.url) urls.push(file.url);
    });
  });

  const seen = new Set<string>();
  return urls.filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

async function ensureUniqueProductSlug(storefrontId: string, title: string) {
  const baseSlug = slugify(title || "printful-product");
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.product.findFirst({
      where: { storefrontId, slug: candidate },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

function requireOAuthConfig() {
  const clientId = String(process.env.PRINTFUL_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.PRINTFUL_OAUTH_CLIENT_SECRET || "").trim();
  const redirectUri = String(process.env.PRINTFUL_OAUTH_REDIRECT_URI || "").trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Printful OAuth environment variables are not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

function signStateCookie(payload: { sub: string; organiserId: string; nonce: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: Math.floor(STATE_TTL_MS / 1000) });
}

function verifyStateCookie(token: string) {
  return jwt.verify(token, JWT_SECRET) as { sub: string; organiserId: string; nonce: string };
}

router.get("/integrations/printful/connect", requireAdminOrOrganiser, (req, res) => {
  try {
    const { clientId, redirectUri } = requireOAuthConfig();
    const organiserId = resolveOrganiserId(req);

    if (!organiserId) {
      return res.status(400).json({ ok: false, error: "Missing organiser id" });
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const stateToken = signStateCookie({ sub: String(req.user?.id || ""), organiserId, nonce });

    res.cookie(STATE_COOKIE, stateToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureCookie(req),
      maxAge: STATE_TTL_MS,
      path: "/",
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_url: redirectUri,
      state: nonce,
    });

    return res.redirect(`${PRINTFUL_AUTHORIZE_URL}?${params.toString()}`);
  } catch (err: any) {
    console.error("[printful] connect failed", err);
    return res.status(500).json({ ok: false, error: "Failed to start Printful connection" });
  }
});

router.get("/integrations/printful/callback", requireAdminOrOrganiser, async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const includeDetail = process.env.NODE_ENV !== "production" || isAdmin(req);
  const detail = {
    token_exchange_status: null as number | null,
    token_exchange_body: null as string | null,
    prisma_error: null as string | null,
  };

  if (!code || !state) {
    console.warn("[printful] missing oauth parameters", { hasCode: Boolean(code), hasState: Boolean(state) });
    return res.status(400).json({ ok: false, error: "Missing OAuth parameters" });
  }

  const stateCookie = req.cookies?.[STATE_COOKIE];
  if (!stateCookie) {
    console.warn("[printful] missing oauth state cookie");
    return res.status(400).json({ ok: false, error: "Missing OAuth state" });
  }

  let statePayload: { sub: string; organiserId: string; nonce: string };
  try {
    statePayload = verifyStateCookie(stateCookie);
    console.info("[printful] state validation ok", {
      organiserId: statePayload.organiserId,
      sub: statePayload.sub,
    });
  } catch (err) {
    console.error("[printful] invalid state cookie", err);
    return res.status(400).json({ ok: false, error: "Invalid OAuth state" });
  }

  if (statePayload.nonce !== state) {
    console.warn("[printful] oauth state mismatch", { organiserId: statePayload.organiserId });
    return res.status(400).json({ ok: false, error: "OAuth state mismatch" });
  }

  if (String(req.user?.id || "") !== statePayload.sub) {
    console.warn("[printful] oauth user mismatch", { organiserId: statePayload.organiserId });
    return res.status(403).json({ ok: false, error: "OAuth user mismatch" });
  }

  try {
    const { clientId, clientSecret, redirectUri } = requireOAuthConfig();

    console.info("[printful] token exchange request made", { organiserId: statePayload.organiserId });
    const tokenRes = await fetch(PRINTFUL_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_url: redirectUri,
      }).toString(),
    });
    const tokenBody = await tokenRes.text();
    detail.token_exchange_status = tokenRes.status;
    detail.token_exchange_body = tokenBody;
    console.info("[printful] token exchange response", {
      status: tokenRes.status,
      body: tokenBody,
    });

    if (!tokenRes.ok) {
      console.error("[printful] token exchange failed", tokenBody);
      const responsePayload = {
        ok: false,
        error: "Failed to connect to Printful",
        code: "TOKEN_EXCHANGE_FAILED",
        ...(includeDetail ? { detail } : {}),
      };
      return res.status(502).json(responsePayload);
    }

    let tokenJson: { access_token?: string; refresh_token?: string; expires_in?: number } = {};
    try {
      tokenJson = tokenBody ? JSON.parse(tokenBody) : {};
    } catch (err) {
      console.error("[printful] token exchange parse failed", err);
      const responsePayload = {
        ok: false,
        error: "Failed to connect to Printful",
        code: "TOKEN_EXCHANGE_PARSE_FAILED",
        ...(includeDetail ? { detail } : {}),
      };
      return res.status(502).json(responsePayload);
    }

    const accessToken = tokenJson.access_token || "";
    if (!accessToken) {
      const responsePayload = {
        ok: false,
        error: "Printful token missing",
        code: "TOKEN_EXCHANGE_MISSING_TOKEN",
        ...(includeDetail ? { detail } : {}),
      };
      return res.status(502).json(responsePayload);
    }

    const refreshToken = tokenJson.refresh_token || null;
    const expiresIn = Number(tokenJson.expires_in || 0);
    const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    try {
      await prisma.fulfilmentIntegration.upsert({
        where: {
          organiserId_provider: {
            organiserId: statePayload.organiserId,
            provider: "PRINTFUL",
          },
        },
        update: {
          accessTokenEncrypted: encryptToken(accessToken),
          refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken) : null,
          accessTokenExpiresAt: expiresAt,
        },
        create: {
          organiserId: statePayload.organiserId,
          provider: "PRINTFUL",
          accessTokenEncrypted: encryptToken(accessToken),
          refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken) : null,
          accessTokenExpiresAt: expiresAt,
        },
      });
      console.info("[printful] db write succeeded", { organiserId: statePayload.organiserId });
    } catch (err: any) {
      detail.prisma_error = String(err?.message || err);
      console.error("[printful] db write failed", err);
      const responsePayload = {
        ok: false,
        error: "Failed to complete Printful connection",
        code: "DB_WRITE_FAILED",
        ...(includeDetail ? { detail } : {}),
      };
      return res.status(500).json(responsePayload);
    }

    res.clearCookie(STATE_COOKIE, { path: "/" });

    return res.json({
      ok: true,
      status: "CONNECTED",
      tokenExpiresAt: expiresAt,
    });
  } catch (err: any) {
    console.error("[printful] callback failed", err);
    const responsePayload = {
      ok: false,
      error: "Failed to complete Printful connection",
      code: "CALLBACK_FAILED",
      ...(includeDetail ? { detail } : {}),
    };
    return res.status(500).json(responsePayload);
  }
});

router.post("/integrations/printful/disconnect", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = resolveOrganiserId(req);
    if (!organiserId) {
      return res.status(400).json({ ok: false, error: "Missing organiser id" });
    }

    const existing = await prisma.fulfilmentIntegration.findUnique({
      where: { organiserId_provider: { organiserId, provider: "PRINTFUL" } },
    });

    if (existing) {
      await prisma.fulfilmentIntegration.update({
        where: { id: existing.id },
        data: {
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          accessTokenExpiresAt: null,
        },
      });
    }

    return res.json({ ok: true, status: "DISCONNECTED" });
  } catch (err: any) {
    console.error("[printful] disconnect failed", err);
    return res.status(500).json({ ok: false, error: "Failed to disconnect Printful" });
  }
});

router.get("/integrations/printful/status", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = resolveOrganiserId(req);
    if (!organiserId) {
      return res.status(400).json({ ok: false, error: "Missing organiser id" });
    }

    const integration = await prisma.fulfilmentIntegration.findUnique({
      where: { organiserId_provider: { organiserId, provider: "PRINTFUL" } },
    });

    const isConnected = Boolean(integration?.accessTokenEncrypted);

    return res.json({
      ok: true,
      status: isConnected ? "CONNECTED" : "DISCONNECTED",
      tokenExpiresAt: integration?.accessTokenExpiresAt ?? null,
    });
  } catch (err: any) {
    console.error("[printful] status failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load Printful status" });
  }
});

router.post("/integrations/printful/import", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = resolveOrganiserId(req);
    if (!organiserId) {
      return res.status(400).json({ ok: false, error: "Missing organiser id" });
    }

    const payload = req.body || {};
    const printfulProductId = String(payload.printfulProductId || "").trim();
    const storefrontId = payload.storefrontId ? String(payload.storefrontId) : "";

    if (!printfulProductId) {
      return res.status(400).json({ ok: false, error: "Printful product id is required" });
    }

    const storefront = storefrontId
      ? await prisma.storefront.findFirst({ where: { id: storefrontId, ownerUserId: organiserId } })
      : await prisma.storefront.findFirst({ where: { ownerUserId: organiserId } });

    if (!storefront) {
      return res.status(404).json({ ok: false, error: "Storefront not found" });
    }

    const client = await createPrintfulClient(organiserId);
    const printfulProduct = await client.fetchProduct(printfulProductId);
    const syncProduct = printfulProduct.result?.sync_product;
    const syncVariants = printfulProduct.result?.sync_variants || [];

    if (!syncProduct) {
      return res.status(404).json({ ok: false, error: "Printful product not found" });
    }

    const variantPayloads = syncVariants.map((variant, index) => ({
      title: String(variant.name || `Variant ${index + 1}`).trim(),
      sku: variant.sku ? String(variant.sku).trim() : null,
      pricePenceOverride: parsePriceToPence(variant.retail_price),
      sortOrder: index,
      providerVariantId: variant.variant_id || variant.id || null,
    }));

    const prices = variantPayloads
      .map((variant) => variant.pricePenceOverride)
      .filter((value): value is number => typeof value === "number");
    const pricePence = prices.length ? Math.min(...prices) : null;

    const imageUrls = collectImageUrls({ sync_product: syncProduct, sync_variants: syncVariants });

    const existingMapping = await prisma.fulfilmentProductMapping.findFirst({
      where: {
        organiserId,
        provider: "PRINTFUL",
        providerProductId: printfulProductId,
        productVariantId: null,
      },
    });

    const product = await prisma.$transaction(async (tx) => {
      const baseData = {
        storefrontId: storefront.id,
        title: String(syncProduct.name || "Printful product").trim(),
        description: syncProduct.description || null,
        category: "MERCH" as const,
        fulfilmentType: "PRINTFUL" as const,
        status: "DRAFT" as const,
        pricePence,
        currency: "gbp",
        inventoryMode: "UNLIMITED" as const,
      };

      const productRow = existingMapping
        ? await tx.product.update({
            where: { id: existingMapping.productId },
            data: baseData,
          })
        : await tx.product.create({
            data: {
              ...baseData,
              slug: await ensureUniqueProductSlug(storefront.id, baseData.title),
            },
          });

      await tx.productVariant.deleteMany({ where: { productId: productRow.id } });
      await tx.productImage.deleteMany({ where: { productId: productRow.id } });
      await tx.fulfilmentProductMapping.deleteMany({
        where: { productId: productRow.id, provider: "PRINTFUL", productVariantId: { not: null } },
      });

      const createdVariants = [];
      for (const variant of variantPayloads) {
        if (!variant.title) continue;
        const created = await tx.productVariant.create({
          data: {
            productId: productRow.id,
            title: variant.title,
            sku: variant.sku,
            pricePenceOverride: variant.pricePenceOverride,
            sortOrder: variant.sortOrder,
          },
        });
        createdVariants.push({ row: created, providerVariantId: variant.providerVariantId });
      }

      if (imageUrls.length) {
        await tx.productImage.createMany({
          data: imageUrls.map((url, index) => ({
            productId: productRow.id,
            url,
            sortOrder: index,
          })),
        });
      }

      const existingProductMapping = await tx.fulfilmentProductMapping.findFirst({
        where: {
          organiserId,
          provider: "PRINTFUL",
          productId: productRow.id,
          productVariantId: null,
        },
      });

      if (existingProductMapping) {
        await tx.fulfilmentProductMapping.update({
          where: { id: existingProductMapping.id },
          data: {
            organiserId,
            providerProductId: printfulProductId,
            providerVariantId: null,
          },
        });
      } else {
        await tx.fulfilmentProductMapping.create({
          data: {
            organiserId,
            provider: "PRINTFUL",
            productId: productRow.id,
            productVariantId: null,
            providerProductId: printfulProductId,
            providerVariantId: null,
          },
        });
      }

      for (const variant of createdVariants) {
        if (!variant.providerVariantId) continue;
        await tx.fulfilmentProductMapping.upsert({
          where: {
            provider_productId_productVariantId: {
              provider: "PRINTFUL",
              productId: productRow.id,
              productVariantId: variant.row.id,
            },
          },
          update: {
            organiserId,
            providerProductId: printfulProductId,
            providerVariantId: String(variant.providerVariantId),
          },
          create: {
            organiserId,
            provider: "PRINTFUL",
            productId: productRow.id,
            productVariantId: variant.row.id,
            providerProductId: printfulProductId,
            providerVariantId: String(variant.providerVariantId),
          },
        });
      }

      return productRow;
    });

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { variants: true, images: true },
    });

    return res.json({ ok: true, product: fullProduct });
  } catch (err: any) {
    console.error("[printful] import failed", err);
    return res.status(500).json({ ok: false, error: err?.message || "Failed to import Printful product" });
  }
});

export default router;
