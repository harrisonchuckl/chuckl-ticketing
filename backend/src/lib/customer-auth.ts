import type { Request, Response } from "express";
import { createJwt, verifyJwt } from "../utils/security.js";

const CUSTOMER_COOKIE = "customer_auth";
const SESSION_MS = Number(process.env.CUSTOMER_SESSION_MS || 60 * 60 * 1000);

export type CustomerSession = {
  sub: string;
  email?: string;
  type?: string;
  mode?: "VENUE" | "GLOBAL";
  activeOrganiserSlug?: string;
  activeOrganiserId?: string;
};

export async function signCustomerToken(payload: {
  id: string;
  email: string;
  mode?: "VENUE" | "GLOBAL";
  activeOrganiserSlug?: string;
  activeOrganiserId?: string;
}) {
  return createJwt(
    {
      sub: payload.id,
      email: payload.email,
      type: "customer",
      mode: payload.mode ?? "GLOBAL",
      activeOrganiserSlug: payload.activeOrganiserSlug,
      activeOrganiserId: payload.activeOrganiserId,
    },
    Math.floor(SESSION_MS / 1000),
  );
}

export function setCustomerCookie(res: Response, token: string) {
  res.cookie(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MS,
    path: "/",
  });
}

export function clearCustomerCookie(res: Response) {
  res.clearCookie(CUSTOMER_COOKIE, { path: "/" });
}

export async function readCustomerSession(req: Request): Promise<CustomerSession | null> {
  const token = req.cookies?.[CUSTOMER_COOKIE];
  if (!token) return null;
  const payload = await verifyJwt<CustomerSession>(String(token));
  if (!payload || payload.type !== "customer" || !payload.sub) return null;
  return payload;
}
