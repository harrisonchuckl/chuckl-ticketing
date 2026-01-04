import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { encryptToken } from "../lib/token-crypto.js";

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
      redirect_uri: redirectUri,
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

  if (!code || !state) {
    return res.status(400).json({ ok: false, error: "Missing OAuth parameters" });
  }

  const stateCookie = req.cookies?.[STATE_COOKIE];
  if (!stateCookie) {
    return res.status(400).json({ ok: false, error: "Missing OAuth state" });
  }

  let statePayload: { sub: string; organiserId: string; nonce: string };
  try {
    statePayload = verifyStateCookie(stateCookie);
  } catch (err) {
    console.error("[printful] invalid state cookie", err);
    return res.status(400).json({ ok: false, error: "Invalid OAuth state" });
  }

  if (statePayload.nonce !== state) {
    return res.status(400).json({ ok: false, error: "OAuth state mismatch" });
  }

  if (String(req.user?.id || "") !== statePayload.sub) {
    return res.status(403).json({ ok: false, error: "OAuth user mismatch" });
  }

  try {
    const { clientId, clientSecret, redirectUri } = requireOAuthConfig();

    const tokenRes = await fetch(PRINTFUL_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error("[printful] token exchange failed", errorBody);
      return res.status(502).json({ ok: false, error: "Failed to connect to Printful" });
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const accessToken = tokenJson.access_token || "";
    if (!accessToken) {
      return res.status(502).json({ ok: false, error: "Printful token missing" });
    }

    const refreshToken = tokenJson.refresh_token || null;
    const expiresIn = Number(tokenJson.expires_in || 0);
    const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

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

    res.clearCookie(STATE_COOKIE, { path: "/" });

    return res.json({
      ok: true,
      status: "CONNECTED",
      tokenExpiresAt: expiresAt,
    });
  } catch (err: any) {
    console.error("[printful] callback failed", err);
    return res.status(500).json({ ok: false, error: "Failed to complete Printful connection" });
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

export default router;
