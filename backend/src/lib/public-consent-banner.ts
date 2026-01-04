import type { Request } from "express";
import { hasConsentCookie } from "./auth/cookie.js";

export function buildConsentBanner(req: Request) {
  if (hasConsentCookie(req)) {
    return { styles: "", banner: "" };
  }

  const styles = `
  <style>
    .consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;background:#0f172a;color:#fff;border-radius:12px;padding:12px 16px;box-shadow:0 12px 30px rgba(0,0,0,0.25);display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;font-size:0.9rem}
    .consent-banner__actions{display:flex;gap:10px;flex-wrap:wrap}
    .consent-banner__actions form{margin:0}
    .consent-banner__btn{border:0;border-radius:999px;padding:8px 14px;font-weight:600;cursor:pointer}
    .consent-banner__accept{background:#22c55e;color:#0f172a}
    .consent-banner__reject{background:#334155;color:#fff}
  </style>
  `;

  const banner = `
  <div class="consent-banner" role="region" aria-label="Cookie consent">
    <span>We use cookies for personalisation.</span>
    <div class="consent-banner__actions">
      <form method="POST" action="/public/consent">
        <input type="hidden" name="personalisation" value="true" />
        <button class="consent-banner__btn consent-banner__accept" type="submit">Accept personalisation</button>
      </form>
      <form method="POST" action="/public/consent">
        <input type="hidden" name="personalisation" value="false" />
        <button class="consent-banner__btn consent-banner__reject" type="submit">Reject</button>
      </form>
    </div>
  </div>
  `;

  return { styles, banner };
}
