import type { Request } from "express";

export const CONSENT_COOKIE_NAME = "tixall_consent";
export const CONSENT_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;

export const CONSENT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: CONSENT_COOKIE_MAX_AGE_MS,
  path: "/",
};

export type ConsentPreferences = {
  personalisation: boolean;
};

export function readConsent(req: Request): ConsentPreferences {
  const raw = req.cookies?.[CONSENT_COOKIE_NAME];
  if (typeof raw !== "string") {
    return { personalisation: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { personalisation?: unknown }).personalisation === "boolean"
    ) {
      return { personalisation: (parsed as { personalisation: boolean }).personalisation };
    }
  } catch {
    // Invalid cookie payloads should fall through to defaults.
  }

  return { personalisation: false };
}

export function hasConsentCookie(req: Request): boolean {
  const raw = req.cookies?.[CONSENT_COOKIE_NAME];
  return typeof raw === "string" && raw.length > 0;
}
