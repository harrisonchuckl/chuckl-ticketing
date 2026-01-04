import prisma from "../../lib/prisma.js";
import { decryptToken, encryptToken } from "../../lib/token-crypto.js";

const PRINTFUL_API_BASE = "https://api.printful.com";
const PRINTFUL_TOKEN_URL = "https://www.printful.com/oauth/token";
const EXPIRY_BUFFER_MS = 60 * 1000;

type PrintfulTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export type PrintfulProductResponse = {
  result?: {
    id?: number;
    sync_product?: {
      id?: number;
      name?: string;
      description?: string;
      thumbnail_url?: string;
      files?: Array<{ preview_url?: string; url?: string }>;
    };
    sync_variants?: Array<{
      id?: number;
      variant_id?: number;
      name?: string;
      sku?: string;
      retail_price?: string;
      files?: Array<{ preview_url?: string; url?: string }>;
    }>;
  };
};

export type PrintfulOrderRecipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  zip: string;
  phone?: string;
  email?: string;
};

export type PrintfulOrderItemPayload = {
  sync_variant_id: number;
  quantity: number;
  external_id?: string;
};

export type PrintfulOrderCreatePayload = {
  external_id: string;
  recipient: PrintfulOrderRecipient;
  items: PrintfulOrderItemPayload[];
};

export type PrintfulOrderCreateResponse = {
  result?: {
    id?: number;
    external_id?: string;
    status?: string;
    costs?: {
      subtotal?: string;
      shipping?: string;
      tax?: string;
      total?: string;
      currency?: string;
    };
  };
};

type PrintfulClient = {
  fetchProduct: (productId: string) => Promise<PrintfulProductResponse>;
  createOrder: (payload: PrintfulOrderCreatePayload) => Promise<{ json: PrintfulOrderCreateResponse; rawBody: string; status: number }>;
};

function requireOAuthConfig() {
  const clientId = String(process.env.PRINTFUL_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.PRINTFUL_OAUTH_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("Printful OAuth environment variables are not configured");
  }
  return { clientId, clientSecret };
}

function tokenIsExpired(expiresAt: Date | null) {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt.getTime() - EXPIRY_BUFFER_MS;
}

async function refreshAccessToken(organiserId: string, refreshToken: string) {
  const { clientId, clientSecret } = requireOAuthConfig();
  const tokenRes = await fetch(PRINTFUL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const tokenBody = await tokenRes.text();
  console.info("[printful] token refresh response", { status: tokenRes.status, body: tokenBody });

  if (!tokenRes.ok) {
    throw new Error(`Printful token refresh failed: ${tokenBody}`);
  }

  const tokenJson = (tokenBody ? JSON.parse(tokenBody) : {}) as PrintfulTokenResponse;
  const accessToken = tokenJson.access_token || "";
  if (!accessToken) {
    throw new Error("Printful refresh missing access token");
  }

  const refreshTokenNext = tokenJson.refresh_token || refreshToken;
  const expiresIn = Number(tokenJson.expires_in || 0);
  const expiresAt =
    Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

  await prisma.fulfilmentIntegration.update({
    where: { organiserId_provider: { organiserId, provider: "PRINTFUL" } },
    data: {
      accessTokenEncrypted: encryptToken(accessToken),
      refreshTokenEncrypted: refreshTokenNext ? encryptToken(refreshTokenNext) : null,
      accessTokenExpiresAt: expiresAt,
    },
  });

  return accessToken;
}

async function resolveAccessToken(organiserId: string) {
  const integration = await prisma.fulfilmentIntegration.findUnique({
    where: { organiserId_provider: { organiserId, provider: "PRINTFUL" } },
  });

  if (!integration?.accessTokenEncrypted) {
    throw new Error("Printful integration is not connected");
  }

  const accessToken = decryptToken(integration.accessTokenEncrypted);
  if (!tokenIsExpired(integration.accessTokenExpiresAt)) {
    return accessToken;
  }

  if (!integration.refreshTokenEncrypted) {
    throw new Error("Printful access token expired. Reconnect Printful to continue.");
  }

  const refreshToken = decryptToken(integration.refreshTokenEncrypted);
  return refreshAccessToken(organiserId, refreshToken);
}

export async function createPrintfulClient(organiserId: string): Promise<PrintfulClient> {
  const accessToken = await resolveAccessToken(organiserId);

  const fetchProduct = async (productId: string) => {
    const res = await fetch(`${PRINTFUL_API_BASE}/store/products/${encodeURIComponent(productId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.text();
    console.info("[printful] fetch product response", { status: res.status, body });
    if (!res.ok) {
      throw new Error(`Printful product fetch failed: ${body}`);
    }
    return (body ? JSON.parse(body) : {}) as PrintfulProductResponse;
  };

  const createOrder = async (payload: PrintfulOrderCreatePayload) => {
    const res = await fetch(`${PRINTFUL_API_BASE}/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    console.info("[printful] create order response", { status: res.status, body });
    if (!res.ok) {
      throw new Error(`Printful order create failed: ${body}`);
    }
    return {
      json: (body ? JSON.parse(body) : {}) as PrintfulOrderCreateResponse,
      rawBody: body,
      status: res.status,
    };
  };

  return { fetchProduct, createOrder };
}
