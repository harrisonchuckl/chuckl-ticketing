import { Router } from "express";
import { CONSENT_COOKIE_NAME, CONSENT_COOKIE_OPTIONS } from "../lib/auth/cookie.js";
import { requireSameOrigin } from "../lib/public-auth-guards.js";

const router = Router();

function parsePersonalisation(value: unknown) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

function resolveRedirect(req: any) {
  const fallback = "/public";
  const referer = req.get("referer");
  if (!referer) return fallback;

  try {
    const url = new URL(referer);
    const host = req.get("host");
    if (host && url.host === host) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    if (referer.startsWith("/")) return referer;
  }

  return fallback;
}

router.post("/consent", requireSameOrigin, (req, res) => {
  const value = parsePersonalisation(req.body?.personalisation);
  if (value === null) {
    return res.status(400).json({ ok: false, error: "Invalid personalisation value" });
  }

  res.cookie(CONSENT_COOKIE_NAME, JSON.stringify({ personalisation: value }), CONSENT_COOKIE_OPTIONS);
  return res.redirect(303, resolveRedirect(req));
});

export default router;
