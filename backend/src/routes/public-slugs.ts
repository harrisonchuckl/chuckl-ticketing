import crypto from "crypto";
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { readCustomerSession } from "../lib/customer-auth.js";
import { readConsent } from "../lib/auth/cookie.js";
import { readStorefrontCartCount } from "../lib/storefront-cart.js";
import { buildConsentBanner } from "../lib/public-consent-banner.js";
import { verifyJwt } from "../utils/security.js";

const router = Router();
const THEME_CACHE_TTL_MS = 30 * 1000;
const themeCache = new Map<string, { expires: number; data: any | null }>();
const SOFT_CUSTOMER_TOKEN_COOKIE = "customer_soft_token";

function hashSoftToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getCachedStorefrontTheme(organiserId: string, page: "ALL_EVENTS" | "EVENT_PAGE") {
  if (!organiserId) return null;
  const key = `${organiserId}:${page}`;
  const cached = themeCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = await prisma.storefrontTheme.findUnique({
    where: { organiserId_page: { organiserId, page } },
  });
  themeCache.set(key, { data, expires: Date.now() + THEME_CACHE_TTL_MS });
  return data;
}

function escHtml(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(v: any) {
  return escHtml(v).replace(/"/g, '"');
}

function toPublicImageUrl(imageUrl: string | null | undefined, width: number) {
  const value = String(imageUrl ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    return `/img/fetch?src=${encodeURIComponent(value)}&w=${width}`;
  }
  return value;
}

function truncateText(value: string | null | undefined, max = 140) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function formatMoney(pence: number | null | undefined, currency?: string | null) {
  const amount = Number(pence || 0) / 100;
  const code = String(currency || "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function normaliseHexColor(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  return `#${match[1].toLowerCase()}`;
}

function normaliseRgbColor(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const rgbMatch = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  const tuple = rgbMatch ? rgbMatch.slice(1) : raw.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/)?.slice(1);
  if (!tuple) return null;
  const nums = tuple.map((n) => Math.max(0, Math.min(255, Number(n))));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return `rgb(${nums.join(", ")})`;
}

function resolveBrandColor(organiser: { brandColorHex?: string | null; brandColorRgb?: string | null }) {
  return normaliseHexColor(organiser.brandColorHex) || normaliseRgbColor(organiser.brandColorRgb);
}

type StorefrontTheme = {
  tokens: {
    fontFamily: string;
    bannerBg: string;
    primary: string;
    primaryText: string;
    pageBg: string;
    cardBg: string;
    text: string;
    mutedText: string;
    borderRadius: number;
  };
  copy: {
    allEventsTitle: string;
    allEventsSubtitle: string;
    eventPageCtaText: string;
    eventPageFromLabel: string;
  };
  footer: { sections: Array<{ title: string; items: string[] }> };
  assets: { logoUrl: string };
};

type RecommendationShow = {
  id: string;
  title: string | null;
  date: Date;
  slug: string | null;
  imageUrl: string | null;
  eventType: string | null;
  venue: { name: string; city: string | null; county: string | null } | null;
};

type RecommendationProduct = {
  id: string;
  title: string;
  slug: string;
  pricePence: number | null;
  currency: string;
  allowCustomAmount: boolean;
  images: Array<{ sortOrder: number; url: string }>;
};

type RecommendationItem =
  | { type: "show"; data: RecommendationShow }
  | { type: "product"; data: RecommendationProduct };

const defaultStorefrontTheme: StorefrontTheme = {
  tokens: {
    fontFamily: "Inter",
    bannerBg: "#0B1220",
    primary: "#2563EB",
    primaryText: "#FFFFFF",
    pageBg: "#F3F4F6",
    cardBg: "#FFFFFF",
    text: "#0F172A",
    mutedText: "#6B7280",
    borderRadius: 16,
  },
  copy: {
    allEventsTitle: "What's On",
    allEventsSubtitle: "",
    eventPageCtaText: "Book Tickets",
    eventPageFromLabel: "From",
  },
  footer: { sections: [] },
  assets: { logoUrl: "" },
};

function buildStorefrontTheme(raw: any): StorefrontTheme {
  const theme: StorefrontTheme = {
    tokens: { ...defaultStorefrontTheme.tokens },
    copy: { ...defaultStorefrontTheme.copy },
    footer: { sections: [] },
    assets: { ...defaultStorefrontTheme.assets },
  };
  const tokenKeys = Object.keys(theme.tokens) as Array<keyof StorefrontTheme["tokens"]>;
  const copyKeys = Object.keys(theme.copy) as Array<keyof StorefrontTheme["copy"]>;

  if (raw && typeof raw === "object") {
    const tokens = raw.tokens || {};
    const copy = raw.copy || {};
    const assets = raw.assets || {};

    tokenKeys.forEach((key) => {
      if (key === "borderRadius") {
        const parsed = Number(tokens[key]);
        if (!Number.isNaN(parsed)) {
          theme.tokens.borderRadius = Math.min(32, Math.max(0, parsed));
        }
        return;
      }
      const value = String(tokens[key] ?? "").trim();
      if (value) {
        theme.tokens[key as Exclude<keyof StorefrontTheme["tokens"], "borderRadius">] = value;
      }
    });

    copyKeys.forEach((key) => {
      const value = String(copy[key] ?? "").trim();
      if (value) {
        theme.copy[key] = value;
      }
    });

    const logoUrl = String(assets.logoUrl ?? "").trim();
    if (logoUrl) {
      theme.assets.logoUrl = logoUrl;
    }

    if (Array.isArray(raw.footer?.sections)) {
      theme.footer.sections = raw.footer.sections
        .filter((section: any) => section && typeof section === "object")
        .map((section: any) => ({
          title: String(section.title ?? "").trim(),
          items: Array.isArray(section.items)
            ? section.items.map((item: any) => String(item ?? "").trim()).filter(Boolean)
            : [],
        }));
    }
  }

  return theme;
}

function getThemeCopyOverrides(raw: any) {
  if (raw && typeof raw === "object" && raw.copy && typeof raw.copy === "object") {
    return raw.copy as Partial<StorefrontTheme["copy"]>;
  }
  return {};
}

function getThemeFooterSections(theme: StorefrontTheme) {
  return theme.footer.sections
    .map((section) => ({
      title: String(section.title || "").trim(),
      items: (section.items || []).map((item) => String(item || "").trim()).filter(Boolean),
    }))
    .filter((section) => section.title || section.items.length);
}

function renderThemeFooter(
  sections: Array<{ title: string; items: string[] }>,
  editorRegionAttr: (label: string) => string,
  editorOverlay: (label: string) => string
) {
  if (!sections.length) return "";
  return `
  <section class="theme-footer"${editorRegionAttr("Footer")} aria-label="Footer">
    <div class="theme-footer__inner">
      <div class="theme-footer__grid">
        ${sections
          .map(
            (section) => `
            <div class="theme-footer__column">
              ${section.title ? `<h3 class="section-heading section-heading--light">${escHtml(section.title)}</h3>` : ""}
              ${
                section.items.length
                  ? `<ul class="theme-footer__list">
                    ${section.items.map((item) => `<li>${escHtml(item)}</li>`).join("")}
                  </ul>`
                  : ""
              }
            </div>
          `
          )
          .join("")}
      </div>
    </div>
    ${editorOverlay("Footer")}
  </section>
  `;
}

function renderThemeVars(theme: StorefrontTheme) {
  return `<style id="storefront-theme-vars">
  :root{
    --theme-font-family: ${escHtml(theme.tokens.fontFamily)};
    --theme-banner-bg: ${escHtml(theme.tokens.bannerBg)};
    --theme-primary: ${escHtml(theme.tokens.primary)};
    --theme-primary-text: ${escHtml(theme.tokens.primaryText)};
    --theme-page-bg: ${escHtml(theme.tokens.pageBg)};
    --theme-card-bg: ${escHtml(theme.tokens.cardBg)};
    --theme-text: ${escHtml(theme.tokens.text)};
    --theme-muted-text: ${escHtml(theme.tokens.mutedText)};
    --theme-radius: ${escHtml(String(theme.tokens.borderRadius))}px;
  }
  </style>`;
}

type EditorTokenPayload = {
  type?: string;
  scope?: string;
  editor?: boolean;
  organiserId?: string;
  storefrontSlug?: string;
};

async function canUseEditorMode(req: any, organiserId: string, storefrontSlug: string | null) {
  const editorRequested = String(req.query?.editor || "") === "1";
  if (!editorRequested) return false;

  const role = String(req.user?.role || "").toUpperCase();
  if (role === "ADMIN" || role === "ORGANISER") return true;

  const token = String(req.query?.token || req.query?.editorToken || "").trim();
  if (!token) return false;

  const payload = await verifyJwt<EditorTokenPayload>(token);
  if (!payload) return false;

  const isEditorToken = payload.type === "storefront-editor" || payload.scope === "storefront-editor" || payload.editor === true;
  if (!isEditorToken) return false;
  if (payload.organiserId && payload.organiserId !== organiserId) return false;
  if (payload.storefrontSlug && storefrontSlug && payload.storefrontSlug !== storefrontSlug) return false;

  return true;
}

async function getBasketCountForStorefront(req: any, storefrontSlug: string, storefrontId: string) {
  const session = await readCustomerSession(req);
  const cookieCount = readStorefrontCartCount(req, storefrontSlug);
  if (!session?.sub) return cookieCount;

  const basket = await prisma.basket.findFirst({
    where: { customerAccountId: String(session.sub), storefrontId },
    select: { items: { select: { qty: true } } },
  });

  const dbCount = (basket?.items || []).reduce((sum, item) => sum + item.qty, 0);
  return dbCount || cookieCount;
}

// Helper to match the SSR brand logic
function getPublicBrand(overrides?: { name?: string | null; logoUrl?: string | null; homeHref?: string | null; color?: string | null }) {
  const name = String(process.env.PUBLIC_BRAND_NAME || 'TixAll').trim();
  const defaultLocalLogo = '/IMG_2374.jpeg'; 
  const logoUrl = String(process.env.PUBLIC_BRAND_LOGO_URL ?? '').trim() || defaultLocalLogo;
  const homeHref = String(process.env.PUBLIC_BRAND_HOME_HREF || '/public').trim();
  const resolvedName = String(overrides?.name || name).trim() || name;
  const resolvedLogo = String(overrides?.logoUrl || logoUrl).trim() || logoUrl;
  const resolvedHome = String(overrides?.homeHref || homeHref).trim() || homeHref;
  const resolvedColor = overrides?.color || null;
  return {
    name: resolvedName,
    logoUrl: toPublicImageUrl(resolvedLogo, 180) || resolvedLogo,
    homeHref: resolvedHome,
    color: resolvedColor
  };
}

function renderAccountPage(opts: {
  storefrontSlug: string | null;
  storefrontName: string | null;
  brand?: { name: string; logoUrl: string; homeHref: string; color?: string | null };
  consentStyles: string;
  consentBanner: string;
}) {
  const brand = opts.brand || getPublicBrand();
  const title = opts.storefrontName ? `${opts.storefrontName} · Account` : "TixAll Account";
  const storefrontSlug = opts.storefrontSlug || "";
  const accountTitle = opts.storefrontName || "TixAll";
  const accountSubtitle = opts.storefrontName
    ? `Access your tickets, orders, and preferences for ${opts.storefrontName}.`
    : "Access your tickets, orders, and preferences across TixAll.";

  const accountHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/account` : "/account";
  const basketHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/basket` : "/public/basket";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escHtml(title)}</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:${escHtml(brand.color || "#0ea5e9")}}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .app-header{position:sticky;top:0;background:rgba(255,255,255,0.95);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--border);z-index:50}
    .app-header-inner{max-width:1200px;margin:0 auto;padding:0 20px;height:64px;display:flex;align-items:center;justify-content:space-between}
    .app-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none}
    .app-brand-logo{height:32px;width:auto;border-radius:8px}
    .app-actions{display:flex;align-items:center;gap:10px}
    .app-action{position:relative;width:45px;height:45px;border-radius:12px;display:grid;place-items:center;color:var(--text);border:1px solid transparent}
    .app-action:hover{border-color:var(--border);background:#f8fafc}
    .app-action svg{width:23px;height:23px}
    .app-action-badge{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center}
    .app-action-badge.is-hidden{display:none}

    .hero{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:8px}
    .hero h1{margin:0;font-size:2rem}
    .hero p{margin:6px 0 0;color:var(--muted)}
    .grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .card h2{margin:0 0 12px;font-size:1.1rem}
    .input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-bottom:10px}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
    .btn.link{border:none;background:none;color:var(--brand);padding:0}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap}
    .hidden{display:none}
    .list{display:grid;gap:12px}
    .list-item{padding:12px;border:1px solid var(--border);border-radius:12px;background:#fff}
    .muted{color:var(--muted)}
    .menu{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}
    .tag{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:#e2e8f0;font-size:.8rem}
  </style>
  ${opts.consentStyles}
</head>
<body>
  ${opts.consentBanner}
  <header class="app-header">
    <div class="app-header-inner">
      <a href="${escAttr(brand.homeHref || "/public")}" class="app-brand" aria-label="${escAttr(brand.name)}">
        <img class="app-brand-logo" src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.name)}" />
      </a>
      <div class="app-actions">
        <a class="app-action" href="${escAttr(basketHref)}" aria-label="View basket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1"></circle>
            <circle cx="17" cy="20" r="1"></circle>
            <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"></path>
          </svg>
          <span class="app-action-badge is-hidden" id="basketCount">0</span>
        </a>
        <a class="app-action" href="${escAttr(accountHref)}" aria-label="Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 1 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
      </div>
    </div>
  </header>

  <div class="wrap">
    <div class="hero">
      <div>
        <h1>${escHtml(accountTitle)} account</h1>
        <p>${escHtml(accountSubtitle)}</p>
      </div>
      <span class="tag">Customer portal</span>
    </div>

    <div class="grid" style="margin-top:24px">
      <div class="card" id="signed-out">
        <h2>Sign in</h2>
        <input class="input" id="loginEmail" type="email" placeholder="Email" autocomplete="email" />
        <input class="input" id="loginPassword" type="password" placeholder="Password" autocomplete="current-password" />
        <div class="btn-row">
          <button class="btn primary" id="loginBtn">Sign in</button>
        </div>
        <p class="muted" style="margin-top:16px">New here? Create an account to manage tickets and orders.</p>
        <input class="input" id="signupName" type="text" placeholder="Full name" autocomplete="name" />
        <input class="input" id="signupEmail" type="email" placeholder="Email" autocomplete="email" />
        <input class="input" id="signupPassword" type="password" placeholder="Password" autocomplete="new-password" />
        <label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
          <input type="checkbox" id="signupConsent" />
          I agree to receive updates from ${escHtml(accountTitle)}.
        </label>
        <div class="btn-row">
          <button class="btn" id="signupBtn">Create account</button>
        </div>
        <p class="muted" id="authMessage"></p>
      </div>

      <div class="card hidden" id="signed-in">
        <h2>My account</h2>
        <p class="muted" id="welcomeText"></p>
        <div class="menu">
          <a class="btn" href="#orders">Orders</a>
          <a class="btn" href="#tickets">Tickets</a>
          <a class="btn" href="#products">Products</a>
          <a class="btn" href="#settings">Settings</a>
          <button class="btn" id="logoutBtn">Sign out</button>
        </div>
      </div>

      <div class="card" id="orders">
        <h2>Orders</h2>
        <div class="list" id="ordersList"><span class="muted">Sign in to view your orders.</span></div>
      </div>

      <div class="card" id="tickets">
        <h2>Tickets</h2>
        <div class="list" id="ticketsList"><span class="muted">Sign in to view your tickets.</span></div>
      </div>

      <div class="card" id="products">
        <h2>Products</h2>
        <div class="list" id="productsList"><span class="muted">Sign in to view your products.</span></div>
      </div>

      <div class="card" id="settings">
        <h2>Saved details</h2>
        <input class="input" id="profileName" type="text" placeholder="Name" />
        <input class="input" id="profilePhone" type="text" placeholder="Phone" />
        <label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
          <input type="checkbox" id="globalConsent" />
          I want to receive updates from TixAll.
        </label>
        ${
          storefrontSlug
            ? `<label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
              <input type="checkbox" id="storefrontConsent" />
              I want to receive updates from ${escHtml(accountTitle)}.
            </label>`
            : ""
        }
        <div class="btn-row">
          <button class="btn primary" id="saveProfileBtn">Save</button>
        </div>
        <p class="muted" id="saveMessage"></p>
      </div>
    </div>
  </div>

  <script>
    const storefrontSlug = ${storefrontSlug ? `"${escAttr(storefrontSlug)}"` : "null"};

    const authMessage = document.getElementById('authMessage');
    const signedOut = document.getElementById('signed-out');
    const signedIn = document.getElementById('signed-in');
    const welcomeText = document.getElementById('welcomeText');
    const ordersList = document.getElementById('ordersList');
    const ticketsList = document.getElementById('ticketsList');
    const productsList = document.getElementById('productsList');
    const basketCount = document.getElementById('basketCount');

    function formatDate(raw) {
      if (!raw) return '';
      const d = new Date(raw);
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatMoney(pence) {
      return '£' + (Number(pence || 0) / 100).toFixed(2);
    }

    async function postJSON(url, payload) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function patchJSON(url, payload) {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function getJSON(url) {
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function loadSession() {
      const sessionUrl = storefrontSlug
        ? '/public/auth/session?storefront=' + encodeURIComponent(storefrontSlug)
        : '/public/auth/session';
      try {
        const data = await getJSON(sessionUrl);
        if (!data.ok) return null;
        return data;
      } catch {
        return null;
      }
    }

    async function loadOrders() {
      if (!storefrontSlug) {
        const data = await getJSON('/public/customer/orders');
        return data.items || [];
      }
      const data = await getJSON('/public/customer/orders?storefront=' + encodeURIComponent(storefrontSlug));
      return data.items || [];
    }

    async function loadTickets() {
      if (!storefrontSlug) {
        const data = await getJSON('/public/customer/tickets');
        return data.items || [];
      }
      const data = await getJSON('/public/customer/tickets?storefront=' + encodeURIComponent(storefrontSlug));
      return data.items || [];
    }

    async function loadProducts() {
      if (!storefrontSlug) {
        const data = await getJSON('/public/customer/products');
        return data.items || [];
      }
      const data = await getJSON('/public/customer/products?storefront=' + encodeURIComponent(storefrontSlug));
      return data.items || [];
    }


    function renderOrders(items) {
      if (!items.length) {
        ordersList.innerHTML = '<span class=\"muted\">No orders yet for this account.</span>';
        return;
      }
      ordersList.innerHTML = items.map(item => {
        const venue = item.venue ? [item.venue.name, item.venue.city].filter(Boolean).join(' · ') : '';
        const ticketsLabel = item.ticketsCount ? item.ticketsCount + ' tickets' : '';
        const productsLabel = item.productOrdersCount ? item.productOrdersCount + ' products' : '';
        const totals = [ticketsLabel, productsLabel].filter(Boolean).join(' · ');
        const pdfUrl = storefrontSlug
          ? '/public/customer/orders/' + encodeURIComponent(item.id) + '/tickets.pdf?storefront=' + encodeURIComponent(storefrontSlug)
          : '/public/customer/orders/' + encodeURIComponent(item.id) + '/tickets.pdf';
        return '<div class=\"list-item\">' +
          '<strong>' + item.showTitle + '</strong>' +
          '<div class=\"muted\">' + [formatDate(item.showDate), venue].filter(Boolean).join(' • ') + '</div>' +
          '<div style=\"margin-top:6px\">' + [formatMoney(item.amountPence), item.status, totals].filter(Boolean).join(' · ') + '</div>' +
          '<div class=\"btn-row\" style=\"margin-top:8px\">' +
            (item.ticketsCount ? '<a class=\"btn\" href=\"' + pdfUrl + '\">Download tickets</a>' : '') +
            '<button class=\"btn\" data-order-resend=\"' + item.id + '\">Resend confirmation email</button>' +
          '</div>' +
        '</div>';
      }).join('');

      ordersList.querySelectorAll('[data-order-resend]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const orderId = btn.getAttribute('data-order-resend');
          if (!orderId) return;
          btn.setAttribute('disabled', 'true');
          btn.textContent = 'Sending…';
          try {
            const url = storefrontSlug
              ? '/public/customer/orders/' + encodeURIComponent(orderId) + '/resend?storefront=' + encodeURIComponent(storefrontSlug)
              : '/public/customer/orders/' + encodeURIComponent(orderId) + '/resend';
            await postJSON(url, {});
            btn.textContent = 'Email sent';
          } catch (err) {
            btn.textContent = 'Resend confirmation email';
          } finally {
            setTimeout(() => btn.removeAttribute('disabled'), 1000);
          }
        });
      });
    }

    function renderTickets(items) {
      if (!items.length) {
        ticketsList.innerHTML = '<span class=\"muted\">No tickets yet for this account.</span>';
        return;
      }
      ticketsList.innerHTML = items.map(item => {
        const venue = item.venue ? [item.venue.name, item.venue.city].filter(Boolean).join(' · ') : '';
        const ticketRows = (item.tickets || []).map(ticket => {
          const details = [ticket.ticketType, ticket.seatRef, ticket.serial].filter(Boolean).join(' · ');
          return '<div class=\"muted\">' + details + '</div>';
        }).join('');
        return '<div class=\"list-item\">' +
          '<strong>' + item.showTitle + '</strong>' +
          '<div class=\"muted\">' + [formatDate(item.showDate), venue].filter(Boolean).join(' • ') + '</div>' +
          '<div style=\"margin-top:6px\">' +
            '<a class=\"btn\" href=\"' + item.pdfUrl + '\">Download PDF tickets</a>' +
          '</div>' +
          '<div style=\"margin-top:8px\">' + (ticketRows || '<span class=\"muted\">No ticket details available.</span>') + '</div>' +
        '</div>';
      }).join('');
    }

    function renderProducts(items) {
      if (!items.length) {
        productsList.innerHTML = '<span class=\"muted\">No products purchased yet.</span>';
        return;
      }
      productsList.innerHTML = items.map(item => {
        const lines = (item.items || []).map(line => {
          const title = [line.title, line.variant].filter(Boolean).join(' · ');
          const fulfilment = line.fulfilmentStatus ? ' · ' + line.fulfilmentStatus : '';
          const trackingBits = [];
          if (line.trackingNumber) trackingBits.push('No. ' + line.trackingNumber);
          if (line.trackingCarrier) trackingBits.push(line.trackingCarrier);
          const trackingLabel = trackingBits.length ? trackingBits.join(' · ') : '';
          const trackingLink = line.trackingUrl
            ? '<a class=\"btn\" href=\"' + line.trackingUrl + '\" target=\"_blank\" rel=\"noreferrer\">Track shipment</a>'
            : '';
          return ''
            + '<div class=\"muted\">' + title + ' · ' + line.qty + ' × ' + formatMoney(line.unitPricePence) + fulfilment + '</div>'
            + (trackingLabel ? '<div class=\"muted\">Tracking: ' + trackingLabel + '</div>' : '')
            + (trackingLink ? '<div style=\"margin-top:6px\">' + trackingLink + '</div>' : '');
        }).join('');
        return '<div class=\"list-item\">' +
          '<strong>Order ' + item.orderId + '</strong>' +
          '<div class=\"muted\">' + [formatDate(item.createdAt), item.status].filter(Boolean).join(' • ') + '</div>' +
          '<div style=\"margin-top:6px\">Total: ' + formatMoney(item.totalPence) + '</div>' +
          '<div style=\"margin-top:8px\">' + lines + '</div>' +
        '</div>';
      }).join('');
    }


    async function loadBasketCount() {
      if (!storefrontSlug) return;
      try {
        const data = await getJSON('/public/basket?storefront=' + encodeURIComponent(storefrontSlug));
        const count = (data.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
        if (count) {
          basketCount.textContent = count;
          basketCount.classList.remove('is-hidden');
        }
      } catch {}
    }

    async function applySession() {
      const data = await loadSession();
      if (!data || !data.customer) return;

      signedOut.classList.add('hidden');
      signedIn.classList.remove('hidden');
      welcomeText.textContent = 'Signed in as ' + data.customer.email;

      document.getElementById('profileName').value = data.customer.name || '';
      document.getElementById('profilePhone').value = data.customer.phone || '';
      document.getElementById('globalConsent').checked = Boolean(data.customer.marketingConsent);

      if (storefrontSlug) {
        const storefrontConsent = document.getElementById('storefrontConsent');
        if (storefrontConsent) storefrontConsent.checked = Boolean(data.membership && data.membership.marketingOptIn);
      }

      const [orders, tickets, products] = await Promise.all([
        loadOrders(),
        loadTickets(),
        loadProducts(),
      ]);
      renderOrders(orders);
      renderTickets(tickets);
      renderProducts(products);
    }

    document.getElementById('loginBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        await postJSON('/public/auth/login', {
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value,
          storefrontSlug,
        });
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Sign in failed';
      }
    });

    document.getElementById('signupBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        const data = await postJSON('/public/auth/signup', {
          name: document.getElementById('signupName').value,
          email: document.getElementById('signupEmail').value,
          password: document.getElementById('signupPassword').value,
          marketingConsent: document.getElementById('signupConsent').checked,
          storefrontSlug,
        });
        if (data.requiresVerification) {
          authMessage.textContent = data.message || 'Check your email to verify your account.';
          return;
        }
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Signup failed';
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await postJSON('/public/auth/logout');
      location.reload();
    });

    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
      const saveMessage = document.getElementById('saveMessage');
      saveMessage.textContent = '';
      try {
        await patchJSON('/public/customer/profile', {
          name: document.getElementById('profileName').value,
          phone: document.getElementById('profilePhone').value,
          marketingConsent: document.getElementById('globalConsent').checked,
        });
        if (storefrontSlug) {
          const storefrontConsent = document.getElementById('storefrontConsent');
          if (storefrontConsent) {
            await patchJSON('/public/customer/membership?storefront=' + encodeURIComponent(storefrontSlug), {
              marketingOptIn: storefrontConsent.checked,
            });
          }
        }
        saveMessage.textContent = 'Saved!';
      } catch (err) {
        saveMessage.textContent = err.message || 'Save failed';
      }
    });

    loadBasketCount();
    applySession();
  </script>
</body>
</html>`;
}

function renderBasketPage(opts: {
  storefrontSlug: string | null;
  storefrontName: string | null;
  brand?: { name: string; logoUrl: string; homeHref: string; color?: string | null };
  consentStyles: string;
  consentBanner: string;
}) {
  const brand = opts.brand || getPublicBrand();
  const title = opts.storefrontName ? `${opts.storefrontName} · Basket` : "Basket";
  const storefrontSlug = opts.storefrontSlug || "";
  const accountHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/account` : "/account";
  const basketHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/basket` : "/public/basket";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escHtml(title)}</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:${escHtml(brand.color || "#0ea5e9")}}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .app-header{position:sticky;top:0;background:rgba(255,255,255,0.95);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--border);z-index:50}
    .app-header-inner{max-width:1200px;margin:0 auto;padding:0 20px;height:64px;display:flex;align-items:center;justify-content:space-between}
    .app-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none}
    .app-brand-logo{height:32px;width:auto;border-radius:8px}
    .app-actions{display:flex;align-items:center;gap:10px}
    .app-action{position:relative;width:45px;height:45px;border-radius:12px;display:grid;place-items:center;color:var(--text);border:1px solid transparent}
    .app-action:hover{border-color:var(--border);background:#f8fafc}
    .app-action svg{width:23px;height:23px}
    .app-action-badge{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center}
    .app-action-badge.is-hidden{display:none}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .list{display:grid;gap:12px}
    .list-item{padding:12px;border:1px solid var(--border);border-radius:12px;background:#fff;display:flex;justify-content:space-between;gap:12px}
    .muted{color:var(--muted)}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
  </style>
  ${opts.consentStyles}
</head>
<body>
  ${opts.consentBanner}
  <header class="app-header">
    <div class="app-header-inner">
      <a href="${escAttr(brand.homeHref || "/public")}" class="app-brand" aria-label="${escAttr(brand.name)}">
        <img class="app-brand-logo" src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.name)}" />
      </a>
      <div class="app-actions">
        <a class="app-action" href="${escAttr(basketHref)}" aria-label="View basket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1"></circle>
            <circle cx="17" cy="20" r="1"></circle>
            <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"></path>
          </svg>
          <span class="app-action-badge is-hidden" id="basketCount">0</span>
        </a>
        <a class="app-action" href="${escAttr(accountHref)}" aria-label="Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 1 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
      </div>
    </div>
  </header>

  <div class="wrap">
    <h1>${escHtml(title)}</h1>
    <div class="card" style="margin-top:16px">
      <div class="list" id="basketList"><span class="muted">Loading basket…</span></div>
      <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
        <strong>Total</strong>
        <strong id="basketTotal">£0.00</strong>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn" href="${storefrontSlug ? `/store/${escAttr(storefrontSlug)}/cart` : "/store"}">Manage in store</a>
        <a class="btn primary" href="${storefrontSlug ? `/store/${escAttr(storefrontSlug)}/cart` : "/store"}">Checkout</a>
      </div>
    </div>
  </div>

  <script>
    const storefrontSlug = ${storefrontSlug ? `"${escAttr(storefrontSlug)}"` : "null"};
    const basketList = document.getElementById('basketList');
    const basketTotal = document.getElementById('basketTotal');
    const basketCount = document.getElementById('basketCount');

    function formatMoney(pence) {
      return '£' + (Number(pence || 0) / 100).toFixed(2);
    }

    async function getJSON(url) {
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function loadBasket() {
      if (!storefrontSlug) {
        basketList.innerHTML = '<span class=\"muted\">No storefront selected.</span>';
        return;
      }
      try {
        const data = await getJSON('/public/basket?storefront=' + encodeURIComponent(storefrontSlug));
        const items = data.items || [];
        if (!items.length) {
          basketList.innerHTML = '<span class=\"muted\">Your basket is empty.</span>';
          return;
        }
        let total = 0;
        basketList.innerHTML = items.map(item => {
          total += Number(item.lineTotalPence || 0);
          return '<div class=\"list-item\">' +
            '<div><strong>' + item.title + '</strong>' +
            (item.variant ? '<div class=\"muted\">' + item.variant + '</div>' : '') +
            '<div class=\"muted\">Qty ' + item.qty + '</div></div>' +
            '<div><strong>' + formatMoney(item.lineTotalPence) + '</strong></div>' +
          '</div>';
        }).join('');
        basketTotal.textContent = formatMoney(total);
        const count = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
        if (count) {
          basketCount.textContent = count;
          basketCount.classList.remove('is-hidden');
        }
      } catch (err) {
        basketList.innerHTML = '<span class=\"muted\">Failed to load basket.</span>';
      }
    }

    loadBasket();
  </script>
</body>
</html>`;
}

router.get("/account", (req, res) => {
  const consent = buildConsentBanner(req);
  res.type("html").send(
    renderAccountPage({
      storefrontSlug: null,
      storefrontName: null,
      consentStyles: consent.styles,
      consentBanner: consent.banner,
    })
  );
});

router.get("/basket", (req, res) => {
  const consent = buildConsentBanner(req);
  res.type("html").send(
    renderBasketPage({
      storefrontSlug: null,
      storefrontName: null,
      consentStyles: consent.styles,
      consentBanner: consent.banner,
    })
  );
});

router.get("/:storefront/account", async (req, res) => {
  const storefrontSlug = String(req.params.storefront || "");
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug },
    select: {
      companyName: true,
      name: true,
      storefrontSlug: true,
      brandLogoUrl: true,
      brandColorHex: true,
      brandColorRgb: true
    },
  });

  if (!organiser) return res.status(404).send("Not found");
  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || null;
  const brand = getPublicBrand({
    name: storefrontName,
    logoUrl: organiser.brandLogoUrl,
    homeHref: `/public/${storefrontSlug}`,
    color: resolveBrandColor(organiser)
  });
  const consent = buildConsentBanner(req);
  res.type("html").send(
    renderAccountPage({
      storefrontSlug,
      storefrontName,
      brand,
      consentStyles: consent.styles,
      consentBanner: consent.banner,
    })
  );
});

router.get("/:storefront/basket", async (req, res) => {
  const storefrontSlug = String(req.params.storefront || "");
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug },
    select: {
      companyName: true,
      name: true,
      storefrontSlug: true,
      brandLogoUrl: true,
      brandColorHex: true,
      brandColorRgb: true
    },
  });

  if (!organiser) return res.status(404).send("Not found");
  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || null;
  const brand = getPublicBrand({
    name: storefrontName,
    logoUrl: organiser.brandLogoUrl,
    homeHref: `/public/${storefrontSlug}`,
    color: resolveBrandColor(organiser)
  });
  const consent = buildConsentBanner(req);
  res.type("html").send(
    renderBasketPage({
      storefrontSlug,
      storefrontName,
      brand,
      consentStyles: consent.styles,
      consentBanner: consent.banner,
    })
  );
});

/**
 * 1) Old URL -> redirect to pretty URL (unless internal rewrite)
 *    /public/event/:id  ->  /public/:storefront/:slug
 */
router.get("/event/:showId", async (req, res, next) => {
if (String(req.query?._internal || "") === "1") return next("router");

  const showId = String(req.params.showId || "");
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      slug: true,
      organiser: { select: { storefrontSlug: true } },
    },
  });

  // If not published / no slug yet, let existing handler render as fallback
if (!show?.slug || !show.organiser?.storefrontSlug) return next("router");

  const params = new URLSearchParams();
  if (String(req.query?.editor || "") === "1") params.set("editor", "1");
  const token = String(req.query?.token || req.query?.editorToken || "").trim();
  if (token) params.set("token", token);
  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  return res.redirect(301, `/public/${show.organiser.storefrontSlug}/${show.slug}${suffix}`);
});

/**
 * 2) Pretty URL -> internally rewrite to /event/:id so your EXISTING booking page renders,
 *    but browser URL stays pretty.
 */
router.get("/:storefront/:slug", async (req, res, next) => {
  const storefront = String(req.params.storefront || "");
  const slug = String(req.params.slug || "");
  if (storefront === "checkout") return next("router");

  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: storefront },
    select: { id: true, storefrontSlug: true },
  });
  if (!organiser) return res.status(404).send("Not found");

  // current slug
  const show = await prisma.show.findFirst({
    where: { organiserId: organiser.id, slug },
    select: { id: true, slug: true },
  });

  if (!show) {
    // old slug -> redirect to current
    const hist = await prisma.showSlugHistory.findFirst({
      where: { organiserId: organiser.id, slug },
      select: { showId: true },
    });

    if (hist?.showId) {
      const current = await prisma.show.findUnique({
        where: { id: hist.showId },
        select: { slug: true },
      });

      if (current?.slug) {
        return res.redirect(301, `/public/${storefront}/${current.slug}`);
      }
    }

    return res.status(404).send("Not found");
  }

  // INTERNAL rewrite to existing booking handler:
  const params = new URLSearchParams({ _internal: "1" });
  if (String(req.query?.editor || "") === "1") params.set("editor", "1");
  const editorToken = String(req.query?.token || req.query?.editorToken || "").trim();
  if (editorToken) params.set("token", editorToken);
  req.url = `/event/${show.id}?${params.toString()}`;
  return next();
});

/**
 * 3) Storefront landing page
 *    /public/:storefront
 */
router.get("/:storefront", async (req, res) => {
  const storefront = String(req.params.storefront || "");
  if (storefront === "checkout") return res.status(404).send("Not found");

  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: storefront },
    select: {
      id: true,
      storefrontSlug: true,
      companyName: true,
      name: true,
      brandLogoUrl: true,
      brandColorHex: true,
      brandColorRgb: true,
    },
  });

  if (!organiser) return res.status(404).send("Not found");

  const shows = await prisma.show.findMany({
    where: { organiserId: organiser.id, status: "LIVE" },
    orderBy: { date: "asc" },
   select: {
      id: true,
      title: true,
      date: true,
      slug: true,
      imageUrl: true,
      description: true,
      eventType: true,
      eventCategory: true,
      externalTicketUrl: true,
      usesExternalTicketing: true,
      venue: { select: { name: true, city: true, county: true } },
      ticketTypes: {
        select: { pricePence: true, available: true },
        orderBy: { pricePence: 'asc' },
        take: 1
      }
    },
  });

  const title = organiser.companyName || organiser.name || organiser.storefrontSlug;
  const brand = getPublicBrand({
    name: title,
    logoUrl: organiser.brandLogoUrl,
    homeHref: organiser.storefrontSlug ? `/public/${organiser.storefrontSlug}` : "/public",
    color: resolveBrandColor(organiser)
  });
  const editorEnabled = await canUseEditorMode(req, organiser.id, organiser.storefrontSlug || null);
  const themeRecord = await getCachedStorefrontTheme(organiser.id, "ALL_EVENTS");
  const themePayload = editorEnabled ? themeRecord?.draftJson ?? themeRecord?.publishedJson : themeRecord?.publishedJson;
  const storefrontTheme = buildStorefrontTheme(themePayload || null);
  const themeCopyOverrides = getThemeCopyOverrides(themePayload);
  const heroTitle = themeCopyOverrides.allEventsTitle ?? defaultStorefrontTheme.copy.allEventsTitle;
  const heroSubtitle = themeCopyOverrides.allEventsSubtitle ?? defaultStorefrontTheme.copy.allEventsSubtitle;
  const themeLogo = storefrontTheme.assets.logoUrl
    ? toPublicImageUrl(storefrontTheme.assets.logoUrl, 180) || storefrontTheme.assets.logoUrl
    : "";
  const logoUrl = themeLogo || brand.logoUrl;
  const editorRegionAttr = (label: string) =>
    editorEnabled ? ` data-editor-region="${escAttr(label)}"` : "";
  const editorOverlay = (label: string) =>
    editorEnabled
      ? `<div class="editor-overlay" aria-hidden="true"><span class="editor-overlay__label">${escHtml(label)}</span></div>`
      : "";
  const editorStyles = editorEnabled
    ? `
  [data-editor-region] {
    position: relative;
  }
  .editor-overlay {
    position: absolute;
    inset: 0;
    border: 2px dashed rgba(37, 99, 235, 0.7);
    border-radius: inherit;
    pointer-events: none;
    z-index: 30;
  }
  .editor-overlay__label {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(15, 23, 42, 0.85);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 4px 10px;
    border-radius: 999px;
  }
`
    : "";
  const themeVars = renderThemeVars(storefrontTheme);
  const editorScript = editorEnabled
    ? `<script>
  (function(){
    function applyTheme(payload){
      if (!payload) return;
      var root = document.documentElement;
      var tokens = payload.tokens || {};
      if (tokens.fontFamily) root.style.setProperty('--theme-font-family', tokens.fontFamily);
      if (tokens.bannerBg) root.style.setProperty('--theme-banner-bg', tokens.bannerBg);
      if (tokens.primary) root.style.setProperty('--theme-primary', tokens.primary);
      if (tokens.primaryText) root.style.setProperty('--theme-primary-text', tokens.primaryText);
      if (tokens.pageBg) root.style.setProperty('--theme-page-bg', tokens.pageBg);
      if (tokens.cardBg) root.style.setProperty('--theme-card-bg', tokens.cardBg);
      if (tokens.text) root.style.setProperty('--theme-text', tokens.text);
      if (tokens.mutedText) root.style.setProperty('--theme-muted-text', tokens.mutedText);
      if (tokens.borderRadius != null && tokens.borderRadius !== '') {
        root.style.setProperty('--theme-radius', tokens.borderRadius + 'px');
      }
      if (payload.copy) {
        document.querySelectorAll('[data-editor-copy]').forEach(function(node){
          var key = node.getAttribute('data-editor-copy');
          if (!key) return;
          var value = payload.copy[key];
          if (typeof value === 'string' && value.trim()) {
            node.textContent = value;
          }
        });
      }
      if (payload.assets) {
        var logo = document.querySelector('[data-editor-logo]');
        if (logo) {
          var url = String(payload.assets.logoUrl || '').trim();
          if (url) {
            logo.setAttribute('src', url);
          } else {
            var fallback = logo.getAttribute('data-default-logo') || '';
            if (fallback) logo.setAttribute('src', fallback);
          }
        }
      }
    }
    window.addEventListener('message', function(event){
      if (!event.data || event.data.type !== 'storefront-theme') return;
      applyTheme(event.data.theme || {});
    });
  })();
  </script>`
    : "";
  const footerSections = getThemeFooterSections(storefrontTheme);
  const footerHtml = footerSections.length
    ? renderThemeFooter(footerSections, editorRegionAttr, editorOverlay)
    : `  <section class="info-strip"${editorRegionAttr("Footer")} aria-label="Contact and policies">
    <div class="info-strip__inner">
      <div class="info-strip__grid">
        <div class="info-strip__column">
          <h3 class="section-heading section-heading--light">Get in touch</h3>
          <p>Email us at hello@tixall.co.uk</p>
          <p>Call 0800 123 4567</p>
        </div>
        <div class="info-strip__column">
          <h3 class="section-heading section-heading--light">Opening times</h3>
          <p>Monday - Friday: 9:00am - 6:00pm</p>
          <p>Saturday: 10:00am - 2:00pm</p>
        </div>
        <div class="info-strip__column">
          <h3 class="section-heading section-heading--light">Ticketing made effortless</h3>
          <p>Powering memorable live events with seamless access.</p>
          <ul class="info-strip__list">
            <li><a class="info-strip__link" href="#">Terms &amp; conditions</a></li>
            <li><a class="info-strip__link" href="#">Privacy policy</a></li>
            <li><a class="info-strip__link" href="#">Accessibility</a></li>
          </ul>
        </div>
      </div>
    </div>
    ${editorOverlay("Footer")}
  </section>`;
  const storefrontSlug = organiser.storefrontSlug || "";
  const storefrontRecord = storefrontSlug
    ? await prisma.storefront.findUnique({ where: { slug: storefrontSlug } })
    : null;
  const cartCount =
    storefrontSlug && storefrontRecord
      ? await getBasketCountForStorefront(req, storefrontSlug, storefrontRecord.id)
      : 0;
  const cartHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/basket` : "/public/basket";
  const accountHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/account` : "/account";

  const visibleShows = shows.filter(show => !!show.slug);
  const featuredShows = visibleShows.slice(0, 6);
  const unique = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean).map(value => value.trim()))).sort();
  const humanize = (value: string) =>
    value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());

  const venueLabels = unique(visibleShows.map(show => show.venue?.name || ""));
  const showVenueName = venueLabels.length > 1;

  const cards = visibleShows
    .map(show => {
      const d = new Date(show.date);
      const dateStr = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timeStr = d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const image = toPublicImageUrl(show.imageUrl, 800);
      const externalTicketUrl = String(show.externalTicketUrl || "").trim();
      const usesExternalTicketing = show.usesExternalTicketing === true;
      const hasAvailableTickets = (show.ticketTypes || []).some(
        ticket => ticket?.available === null || Number(ticket?.available ?? 0) > 0
      );
      const shouldUseExternalTickets =
        !!externalTicketUrl && (usesExternalTicketing || !hasAvailableTickets);
      const quickBookHref = shouldUseExternalTickets
        ? externalTicketUrl
        : `/checkout?showId=${escHtml(show.id)}`;
      const quickBookAttrs = shouldUseExternalTickets
        ? ' target="_blank" rel="noopener"'
        : "";
      return `
        <article class="show-card" data-show
          data-date="${escHtml(show.date.toISOString())}"
          data-type="${escHtml(show.eventType || "")}"
          data-venue="${escHtml(show.venue?.name || "")}"
          data-city="${escHtml(show.venue?.city || "")}"
          data-county="${escHtml(show.venue?.county || "")}">
          <a class="show-card__image" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}" aria-label="View ${escHtml(show.title)}">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(show.title)}" loading="lazy" />`
                : `<div class="show-card__placeholder" aria-hidden="true"></div>`
            }
          </a>
          <div class="show-card__body">
            <div class="show-card__meta">
              <span>${escHtml(dateStr)}</span>
              <span>•</span>
              <span>${escHtml(timeStr)}</span>
            </div>
            <h3 class="show-card__title">${escHtml(show.title || "Untitled show")}</h3>
            ${
              showVenueName
                ? `<div class="show-card__details">${escHtml(show.venue?.name || "Venue TBC")}</div>`
                : ""
            }
            <div class="show-card__actions"${editorRegionAttr("Buttons")}>
              <a class="btn btn--primary" href="${escAttr(quickBookHref)}"${quickBookAttrs}>Quick book</a>
              <a class="btn btn--ghost" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}">More info</a>
              ${editorOverlay("Buttons")}
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  const featuredCards = featuredShows
    .map((show, idx) => {
      const d = new Date(show.date);
      const dateStr = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const summary =
        truncateText(show.description, 160) ||
        (show.eventCategory ? `${show.eventCategory} show.` : "Live event.");
      const image = toPublicImageUrl(show.imageUrl, 1400);
      const externalTicketUrl = String(show.externalTicketUrl || "").trim();
      const usesExternalTicketing = show.usesExternalTicketing === true;
      const hasAvailableTickets = (show.ticketTypes || []).some(
        ticket => ticket?.available === null || Number(ticket?.available ?? 0) > 0
      );
      const shouldUseExternalTickets =
        !!externalTicketUrl && (usesExternalTicketing || !hasAvailableTickets);
      const quickBookHref = shouldUseExternalTickets
        ? externalTicketUrl
        : `/checkout?showId=${escHtml(show.id)}`;
      const quickBookAttrs = shouldUseExternalTickets
        ? ' target="_blank" rel="noopener"'
        : "";
      return `
        <div class="hero-slide${idx === 0 ? " is-active" : ""}" data-slide="${idx}">
          <a class="hero-media" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}" aria-label="View ${escHtml(show.title)}">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(show.title)}" />`
                : `<div class="hero-placeholder" aria-hidden="true"></div>`
            }
          </a>
          <div class="featured-content">
            <span class="hero-eyebrow">Featured show</span>
            <h2>${escHtml(show.title || "Featured show")}</h2>
            <p class="hero-meta">
              ${escHtml(dateStr)}
              ${showVenueName ? ` • ${escHtml(show.venue?.name || "Venue TBC")}` : ""}
            </p>
            <p class="hero-summary">${escHtml(summary)}</p>
            <div class="hero-actions"${editorRegionAttr("Buttons")}>
              <a class="btn btn--primary" href="${escAttr(quickBookHref)}"${quickBookAttrs}>Quick book</a>
              <a class="btn btn--ghost" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}">More info</a>
              ${editorOverlay("Buttons")}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const typeOptions = unique(visibleShows.map(show => show.eventType || ""));
  const venueOptions = unique(visibleShows.map(show => show.venue?.name || ""));
  const cityOptions = unique(visibleShows.map(show => show.venue?.city || ""));
  const countyOptions = unique(visibleShows.map(show => show.venue?.county || ""));
  const showTypeFilter = typeOptions.length > 1;
  const showVenueFilter = venueOptions.length > 1;
  const showCityFilter = showVenueFilter && cityOptions.length > 1;
  const showCountyFilter = showVenueFilter && countyOptions.length > 1;

  const consentPreferences = readConsent(req);
  const customerSession = consentPreferences.personalisation ? await readCustomerSession(req) : null;
  let customerAccountId = customerSession?.sub ? String(customerSession.sub) : null;
  if (!customerAccountId && consentPreferences.personalisation) {
    const softToken = String(req.cookies?.[SOFT_CUSTOMER_TOKEN_COOKIE] || "").trim();
    if (softToken) {
      const tokenHash = hashSoftToken(softToken);
      const rememberToken = await prisma.customerRememberToken.findFirst({
        where: { tokenHash, expiresAt: { gt: new Date() } },
        select: { customerAccountId: true },
      });
      if (rememberToken?.customerAccountId) {
        customerAccountId = rememberToken.customerAccountId;
      }
    }
  }

  const recommendationEvents: RecommendationShow[] = [];
  const recommendationProducts: RecommendationProduct[] = [];
  if (customerAccountId && consentPreferences.personalisation) {
    const paidOrders = await prisma.order.findMany({
      where: {
        customerAccountId,
        status: "PAID",
        show: { organiserId: organiser.id },
      },
      select: {
        show: {
          select: {
            id: true,
            organiserId: true,
            eventType: true,
            venue: { select: { county: true } },
          },
        },
      },
    });

    if (paidOrders.length) {
      const purchasedShowIds = new Set<string>();
      const eventTypes = new Set<string>();
      const counties = new Set<string>();

      for (const order of paidOrders) {
        const show = order.show;
        if (!show) continue;
        purchasedShowIds.add(show.id);
        if (show.eventType) eventTypes.add(show.eventType);
        if (show.venue?.county) counties.add(show.venue.county);
      }

      if (eventTypes.size && counties.size) {
        const recommendations = await prisma.show.findMany({
          where: {
            status: "LIVE",
            date: { gte: new Date() },
            organiserId: organiser.id,
            eventType: { in: Array.from(eventTypes) },
            venue: { county: { in: Array.from(counties) } },
            id: { notIn: Array.from(purchasedShowIds) },
            slug: { not: null },
          },
          select: {
            id: true,
            title: true,
            date: true,
            slug: true,
            imageUrl: true,
            eventType: true,
            venue: { select: { name: true, city: true, county: true } },
          },
          orderBy: { date: "asc" },
          take: 4,
        });
        recommendationEvents.push(...recommendations);
      }
    }

    if (storefrontRecord) {
      const products = await prisma.product.findMany({
        where: { storefrontId: storefrontRecord.id, status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          slug: true,
          pricePence: true,
          allowCustomAmount: true,
          currency: true,
          images: { select: { url: true, sortOrder: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      });
      recommendationProducts.push(...products);
    }
  }

  const previouslyViewed = consentPreferences.personalisation && customerSession?.sub
    ? await prisma.customerShowView.findMany({
        where: {
          customerAccountId: String(customerSession.sub),
          show: { organiserId: organiser.id, status: "LIVE", slug: { not: null } },
        },
        orderBy: { createdAt: "desc" },
        distinct: ["showId"],
        select: {
          show: {
            select: {
              id: true,
              title: true,
              date: true,
              slug: true,
              imageUrl: true,
              eventType: true,
              venue: { select: { name: true, city: true, county: true } },
            },
          },
        },
        take: 6,
      })
    : [];

  const recommendationItems: RecommendationItem[] = [];
  const maxRecommendationItems = 6;
  const maxRecommendations = Math.max(recommendationEvents.length, recommendationProducts.length);
  for (let i = 0; i < maxRecommendations; i += 1) {
    const show = recommendationEvents[i];
    if (show) {
      recommendationItems.push({ type: "show", data: show });
    }
    const product = recommendationProducts[i];
    if (product) {
      recommendationItems.push({ type: "product", data: product });
    }
    if (recommendationItems.length >= maxRecommendationItems) break;
  }

  const recommendationCards = recommendationItems
    .slice(0, maxRecommendationItems)
    .map((item) => {
      if (item.type === "product") {
        const product = item.data;
        const image = product.images?.length
          ? toPublicImageUrl(
              product.images.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url,
              800
            )
          : "";
        const priceLabel = product.allowCustomAmount
          ? "Choose amount"
          : formatMoney(product.pricePence, product.currency);
        return `
        <a class="recommendation-card" href="/store/${escHtml(storefront)}/products/${escHtml(product.slug || "")}">
          <div class="recommendation-card__media">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(product.title || "Product")}" loading="lazy" />`
                : `<div class="recommendation-card__placeholder" aria-hidden="true"></div>`
            }
          </div>
          <div class="recommendation-card__body">
            <div class="recommendation-card__eyebrow">Product</div>
            <div class="recommendation-card__title">${escHtml(product.title || "Product")}</div>
            ${priceLabel ? `<div class="recommendation-card__meta">${escHtml(priceLabel)}</div>` : ""}
          </div>
        </a>
      `;
      }

      const show = item.data;
      const d = show.date ? new Date(show.date) : null;
      const dateStr = d
        ? d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          })
        : "Date TBC";
      const location = [show.venue?.name, show.venue?.city].filter(Boolean).join(", ");
      const image = toPublicImageUrl(show.imageUrl, 800);
      return `
        <a class="recommendation-card" href="/public/${escHtml(storefront)}/${escHtml(show.slug || "")}">
          <div class="recommendation-card__media">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(show.title || "Show")}" loading="lazy" />`
                : `<div class="recommendation-card__placeholder" aria-hidden="true"></div>`
            }
          </div>
          <div class="recommendation-card__body">
            <div class="recommendation-card__eyebrow">${escHtml(dateStr)}</div>
            <div class="recommendation-card__title">${escHtml(show.title || "Untitled show")}</div>
            ${location ? `<div class="recommendation-card__meta">${escHtml(location)}</div>` : ""}
          </div>
        </a>
      `;
    })
    .join("");

  const previouslyViewedCards = previouslyViewed
    .map((entry) => entry.show)
    .filter((show) => show && show.slug)
    .map((show) => {
      const d = show.date ? new Date(show.date) : null;
      const dateStr = d
        ? d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          })
        : "Date TBC";
      const location = [show.venue?.name, show.venue?.city].filter(Boolean).join(", ");
      const image = toPublicImageUrl(show.imageUrl, 800);
      return `
        <a class="recommendation-card" href="/public/${escHtml(storefront)}/${escHtml(show.slug || "")}">
          <div class="recommendation-card__media">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(show.title || "Show")}" loading="lazy" />`
                : `<div class="recommendation-card__placeholder" aria-hidden="true"></div>`
            }
          </div>
          <div class="recommendation-card__body">
            <div class="recommendation-card__eyebrow">${escHtml(dateStr)}</div>
            <div class="recommendation-card__title">${escHtml(show.title || "Untitled show")}</div>
            ${location ? `<div class="recommendation-card__meta">${escHtml(location)}</div>` : ""}
          </div>
        </a>
      `;
    })
    .join("");

  const recommendationsBanner =
    consentPreferences.personalisation && recommendationCards
      ? `
  <section class="recommendations-banner" aria-label="Recommended events">
    <div class="recommendations-banner__inner">
      <div class="recommendations-banner__header">
        <div>
          <h2 class="section-heading">Recommended for you</h2>
          <p class="section-subtitle">Based on your past bookings and store activity.</p>
        </div>
        <a class="btn btn--ghost" href="#all-events">Browse all shows</a>
      </div>
      <div class="recommendations-grid">
        ${recommendationCards}
      </div>
    </div>
  </section>`
      : "";

  const previouslyViewedHtml =
    consentPreferences.personalisation && customerSession?.sub && previouslyViewedCards
      ? `
    <section class="previously-viewed" aria-label="Previously viewed">
      <h2 class="section-heading">Previously viewed</h2>
      <div class="recommendations-grid">
        ${previouslyViewedCards}
      </div>
    </section>
  `
      : "";

  const consent = buildConsentBanner(req);
  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} – Events</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800;900&display=swap" rel="stylesheet">
  ${themeVars}
  ${consent.styles}
 <style>
:root {
  --app-header-h: 64px;

  /* ✅ single source of truth for perfect alignment */
  --container-w: 1200px;
  --page-pad: 20px;

  --bg-page: var(--theme-page-bg, #F3F4F6);
  --bg-surface: var(--theme-card-bg, #FFFFFF);
  --primary: var(--theme-text, #0F172A);
  --brand: var(--theme-primary, ${escHtml(brand.color || "#0f9cdf")});
  --brand-hover: var(--theme-primary, ${escHtml(brand.color || "#0b86c6")});
  --tixall-blue: #009fe3;
  --tixall-blue-hover: #0089c6;
  --text-main: var(--theme-text, #111827);
  --text-muted: var(--theme-muted-text, #6B7280);
  --border: #E5E7EB;
  --radius-md: var(--theme-radius, 12px);
  --radius-lg: var(--theme-radius, 16px);
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --banner-bg: var(--theme-banner-bg, var(--bg-page));
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding-top: var(--app-header-h);
  font-family: var(--theme-font-family, 'Inter'), sans-serif;
  background: var(--bg-page);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
}

/* --- FIXED TOP HEADER --- */
.app-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--app-header-h);
  background: rgba(255,255,255,0.95);
  backdrop-filter: saturate(180%) blur(10px);
  -webkit-backdrop-filter: saturate(180%) blur(10px);
  z-index: 500;
  border-bottom: 1px solid var(--border);
}
.app-header-inner {
  max-width: var(--container-w);
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--page-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.app-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.app-brand-logo {
  height: 32px;
  width: auto;
  border-radius: 8px;
}
.app-brand-text {
  font-family: var(--theme-font-family, 'Outfit'), sans-serif;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--primary);
  font-size: 1.1rem;
}
.app-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-action {
  position: relative;
  width: 45px;
  height: 45px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  text-decoration: none;
  color: var(--text-main);
  border: 1px solid transparent;
}
.app-action:hover {
  border-color: var(--border);
  background: var(--bg-page);
}
.app-action svg {
  width: 23px;
  height: 23px;
}
.app-action-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.app-action-badge.is-hidden { display: none; }

/* --- HERO SECTION --- */
.hero-section {
  background: var(--bg-page);
  color: var(--text-main);
  padding: 42px 0 18px;           /* ✅ remove side padding (fixes 20px drift) */
  position: relative;
}

.hero-content {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 0 var(--page-pad);     /* ✅ match header + wrap left edge exactly */
  text-align: left;
}

.hero-title {
  font-family: var(--theme-font-family, 'Outfit'), sans-serif;
  font-weight: 900;
  font-size: clamp(1.56rem, 3.6vw, 2.7rem); /* ✅ +20% from current */
  margin: 0 0 10px;
  color: var(--primary);
}
.hero-subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--text-muted);
}



/* --- FEATURED SLIDER --- */
.featured-section {
  max-width: var(--container-w);
  margin: -10px auto 40px;
  padding: 0 var(--page-pad);
}


.featured-slider {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: #0b1120;
  box-shadow: var(--shadow-float);
}

.featured-track {
  display: flex;
  transition: transform 0.6s ease;
}

.hero-slide {
  min-width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 32px;
  padding: 32px;
  align-items: center;
}

.hero-media {
  width: 100%;
  border-radius: 18px;
  overflow: hidden;
  background: #111827;
  aspect-ratio: 16/9;
  display: block;
}

.hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1f2937, #0f172a);
}

.featured-content {
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
}

.featured-content h2 {
  font-family: var(--theme-font-family, 'Outfit'), sans-serif;
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  margin: 0;
  font-weight: 800;
}

.hero-meta {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.75);
  margin: 0;
}

.hero-summary {
  font-size: 1rem;
  color: rgba(255,255,255,0.85);
  margin: 0;
  line-height: 1.5;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.featured-nav {
  position: absolute;
  right: 20px;
  bottom: 20px;
  display: flex;
  gap: 8px;
}

.featured-btn {
  border: none;
  background: rgba(255,255,255,0.15);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.featured-btn:hover {
  background: rgba(255,255,255,0.3);
}

.section-heading {
  font-family: var(--theme-font-family, 'Outfit'), sans-serif;
  font-weight: 800;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  margin: 0 0 16px;
  color: var(--primary);
}

.section-subtitle {
  margin: 0;
  color: var(--text-muted);
  font-size: 1rem;
}

.recommendations-banner {
  max-width: var(--container-w);
  margin: 32px auto 0;
  padding: 0 var(--page-pad);
}

.recommendations-banner__inner {
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}

.recommendations-banner__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.recommendation-card {
  text-decoration: none;
  color: inherit;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.recommendation-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

.recommendation-card__media {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--bg-page);
  overflow: hidden;
}

.recommendation-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.recommendation-card__placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #e2e8f0, #f8fafc);
}

.recommendation-card__body {
  padding: 14px;
  display: grid;
  gap: 6px;
}

.recommendation-card__eyebrow {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.recommendation-card__title {
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--primary);
}

.recommendation-card__meta {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.previously-viewed {
  margin-top: 32px;
}

/* --- MAIN CONTENT --- */
.wrap {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 0 var(--page-pad) 80px;
  position: relative;
  z-index: 20;
}

/* --- FILTERS --- */
.filters-bar {
  background: var(--bg-surface);
  padding: 16px;
  border-radius: var(--radius-lg);
box-shadow: 0 8px 10px -3px rgba(0,0,0,0.04), 0 3px 4px -3px rgba(0,0,0,0.03); /* ~60% softer than shadow-float */
  border: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  margin-bottom: 32px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
  flex: 1;
}

.filter-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  font-weight: 700;
}

.filter-select {
  appearance: none;
  background: #F8FAFC;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--text-main);
  font-weight: 500;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px;
  cursor: pointer;
}
.filter-select:hover { border-color: var(--brand); }
.filter-select:focus { outline: 2px solid var(--brand); border-color: var(--brand); }

/* --- GRID --- */
.show-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

/* --- CARD STYLE --- */
.show-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.show-card:hover {
  transform: none;           /* ✅ no extra lift */
  box-shadow: var(--shadow-card); /* ✅ keep same shadow as default */
}


.show-card__image {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--bg-page);
  overflow: hidden;
}

.show-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.show-card:hover .show-card__image img {
  transform: scale(1.05);
}

/* Date Badge on Image */
.date-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
  line-height: 1;
}
.db-month { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 2px; }
.db-day { font-size: 1.2rem; font-weight: 800; color: var(--primary); }

.show-card__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 12px;
}

.show-card__meta {
  font-size: 0.98rem; /* ✅ 0.85 * 1.15 ≈ 0.98 */
  color: var(--tixall-blue);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}


.show-card__title {
  margin: 0;
  font-family: 'Outfit', sans-serif;
  font-size: 1.35rem;
  line-height: 1.2;
  font-weight: 800;
}
.show-card__title a {
  text-decoration: none;
  color: var(--primary);
}
.show-card__title a:hover { color: var(--brand); }

.show-card__details {
  color: var(--text-muted);
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.show-card__actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: auto;
}

.show-card__actions .btn {
  padding: 12px 22px;
  font-size: 1rem;
}

.show-card__footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.price-tag {
  font-weight: 700;
  color: var(--text-main);
  font-size: 1rem;
}

.card-actions {
  display: flex;
  gap: 8px;
}

/* --- BUTTONS --- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn--primary {
  background: var(--tixall-blue);
  color: var(--theme-primary-text, #fff);
  border: 1px solid transparent;
  box-shadow: 0 4px 6px rgba(0, 159, 227, 0.2);
}
.btn--primary:hover {
  background: var(--tixall-blue-hover);
  transform: translateY(-1px);
}

.btn--ghost {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-main);
}
.btn--ghost:hover {
  border-color: var(--brand);
  color: var(--brand);
}

.empty {
  grid-column: 1 / -1;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--border);
}

.load-more {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 24px;
}

.load-more-btn {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-main);
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
  box-shadow: var(--shadow-sm);
}

.load-more-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-card);
}

.load-more-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.load-more-btn.is-loading::after {
  content: "";
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-left: 10px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-right-color: currentColor;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
}

.cta-strip {
  background: var(--tixall-blue);
  color: var(--theme-primary-text, #fff);
}

.cta-strip__inner {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 14px var(--page-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.cta-strip__text {
  margin: 0;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  flex: 1 1 560px;
  min-width: 0;
  line-height: 1.2;
  font-size: 24px;
}

.cta-strip__button {
  display: inline-flex;
    flex: 0 0 auto;   /* ✅ don’t shrink */
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 10px 22px;
  border-radius: 10px;
  border: 2px solid var(--theme-primary-text, #fff);
  color: var(--theme-primary-text, #fff);
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
}

.cta-strip__button:hover {
  background: var(--theme-primary-text, #fff);
  color: var(--tixall-blue);
}

.cta-strip[aria-label="Create account"] .cta-strip__inner {
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.cta-strip[aria-label="Create account"] .cta-strip__text {
  max-width: 900px;
  text-wrap: balance;
}

.cta-strip--products {
  background: var(--theme-banner-bg, #0b1120);
}

.cta-strip--products .cta-strip__inner {
  padding: 38px var(--page-pad);
  align-items: flex-start;
}

.cta-strip__copy p {
  margin: 0;
  max-width: 560px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 1rem;
  line-height: 1.5;
}

.section-heading--light {
  color: var(--theme-primary-text, #fff);
}

.info-strip {
  background: var(--theme-banner-bg, #0b1120);
  color: var(--theme-primary-text, #fff);
}

.info-strip__inner {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 48px var(--page-pad);
}

.info-strip__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
}

.info-strip__column p {
  margin: 0 0 14px;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.5;
}

.info-strip__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.info-strip__link {
  color: var(--theme-primary-text, #fff);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  font-size: 0.9rem;
}

.info-strip__link:hover {
  color: rgba(255, 255, 255, 0.75);
}

.theme-footer {
  background: var(--theme-banner-bg, #0b1120);
  color: var(--theme-primary-text, #fff);
}

.theme-footer__inner {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 48px var(--page-pad);
}

.theme-footer__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
}

.theme-footer__list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.5;
}

.theme-footer__list li {
  margin: 0;
}

.partner-strip {
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
}

.partner-strip__inner {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 16px var(--page-pad);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.partner-strip__logo {
  height: 28px;
  width: auto;
}

@media (max-width: 768px) {
  .app-header-inner { padding: 0 16px; }

  /* ✅ keep hero aligned with header + wrap on mobile */
  .hero-section { padding: 36px 0 20px; }
  .hero-content { padding: 0 16px; }

  /* ✅ +20% from previous mobile size (2.2rem -> 2.64rem) */
  .hero-title { font-size: 2.64rem; }

  .hero-slide { grid-template-columns: 1fr; padding: 20px; }
  .featured-section { margin-top: -10px; }
  .filters-bar { flex-direction: column; align-items: stretch; gap: 12px; }
  .card-actions { width: 100%; }
  .card-actions .btn { flex: 1; }
  .cta-strip[aria-label="Create account"] .cta-strip__inner {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* ✅ Products section can still stack on mobile if you want */
  .cta-strip[aria-label="Products"] .cta-strip__inner {
    flex-direction: column;
    align-items: flex-start;
  }
  .cta-strip--products .cta-strip__inner { padding: 32px 16px; }

  .info-strip__inner { padding: 32px 16px; }
  .info-strip__grid { grid-template-columns: 1fr; }
  .theme-footer__inner { padding: 32px 16px; }
  .theme-footer__grid { grid-template-columns: 1fr; }
  .partner-strip__inner {
    flex-direction: column;
    text-align: center;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1024px) {
  .info-strip__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .theme-footer__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
${editorStyles}
</style>
</head>
<body>
${consent.banner}

  <header class="app-header">
    <div class="app-header-inner">
      <a href="${escAttr(brand.homeHref || '#')}" class="app-brand"${editorRegionAttr("Logo")} aria-label="${escAttr(brand.name)}">
        <img class="app-brand-logo" src="${escAttr(logoUrl)}" alt="${escAttr(brand.name)}" data-editor-logo data-default-logo="${escAttr(brand.logoUrl)}" />
        ${editorOverlay("Logo")}
      </a>
      <div class="app-actions">
        <a class="app-action" href="${cartHref}" aria-label="View basket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1"></circle>
            <circle cx="17" cy="20" r="1"></circle>
            <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"></path>
          </svg>
          <span class="app-action-badge${cartCount ? "" : " is-hidden"}">${cartCount}</span>
        </a>
        <a class="app-action" href="${accountHref}" aria-label="Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 1 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
      </div>
    </div>
  </header>

  ${recommendationsBanner}

  <section class="hero-section"${editorRegionAttr("Banner")}>
    <div class="hero-content"${editorRegionAttr("Headings")}>
      <h1 class="hero-title" data-editor-copy="allEventsTitle">${escHtml(heroTitle)}</h1>
      ${heroSubtitle ? `<p class="hero-subtitle" data-editor-copy="allEventsSubtitle">${escHtml(heroSubtitle)}</p>` : ""}
      ${editorOverlay("Headings")}
    </div>
    ${editorOverlay("Banner")}
  </section>

  ${
    featuredCards
      ? `<section class="featured-section">
          <div class="featured-slider" data-featured-slider>
            <div class="featured-track">
              ${featuredCards}
            </div>
            <div class="featured-nav">
              <button class="featured-btn" type="button" data-featured-prev aria-label="Previous featured show">‹</button>
              <button class="featured-btn" type="button" data-featured-next aria-label="Next featured show">›</button>
            </div>
          </div>
        </section>`
      : ""
  }

  <div class="wrap">
    <h2 class="section-heading" id="all-events">All shows</h2>
    <div class="filters-bar">
      ${
        showTypeFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-type">Category</label>
              <select id="filter-type" class="filter-select">
                <option value="">All categories</option>
                ${typeOptions
                  .map(t => `<option value="${escHtml(t)}">${escHtml(humanize(t))}</option>`)
                  .join("")}
              </select>
            </div>`
          : ""
      }
      ${
        showVenueFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-venue">Venue</label>
              <select id="filter-venue" class="filter-select">
                <option value="">All venues</option>
                ${venueOptions.map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
      ${
        showCityFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-city">Town / city</label>
              <select id="filter-city" class="filter-select">
                <option value="">All towns/cities</option>
                ${cityOptions.map(city => `<option value="${escHtml(city)}">${escHtml(city)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
      ${
        showCountyFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-county">County</label>
              <select id="filter-county" class="filter-select">
                <option value="">All counties</option>
                ${countyOptions.map(county => `<option value="${escHtml(county)}">${escHtml(county)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
    </div>

    <div class="show-grid" id="show-grid"${editorRegionAttr("Tiles")}>
      ${cards || `<div class="empty">No live events scheduled at the moment.</div>`}
      ${editorOverlay("Tiles")}
    </div>
    <div class="load-more" id="load-more" aria-label="Load more shows">
      <button class="load-more-btn" id="load-more-btn" type="button">Load more shows</button>
    </div>

    ${previouslyViewedHtml}
  </div>  

  <section class="cta-strip" aria-label="Create account">
    <div class="cta-strip__inner">
<p class="cta-strip__text">Create an account and get closer to the shows you love.</p>
      <a class="cta-strip__button" href="${accountHref}">Create account</a>
    </div>
  </section>

  <section class="cta-strip cta-strip--products" aria-label="Products">
    <div class="cta-strip__inner">
      <div class="cta-strip__copy">
        <h2 class="section-heading section-heading--light">Products</h2>
        <p>Browse products the event organiser has for sale, plus extras from show promoters.</p>
      </div>
      <a class="cta-strip__button" href="/admin/ui/product-store/products">View products</a>
    </div>
  </section>

  ${footerHtml}

  <section class="partner-strip" aria-label="Advanced ticketing">
    <div class="partner-strip__inner">
      <span>Advanced ticketing and product services powered by</span>
      <img class="partner-strip__logo" src="/TixAll%20on%20White%20Background.png" alt="Tixal" />
    </div>
  </section>
  
  <script>
  (function(){
    const slider = document.querySelector('[data-featured-slider]');
    if (slider){
      const track = slider.querySelector('.featured-track');
      const slides = Array.from(slider.querySelectorAll('.hero-slide'));
      const prevBtn = slider.querySelector('[data-featured-prev]');
      const nextBtn = slider.querySelector('[data-featured-next]');
      let index = 0;
      let intervalId = null;

      const update = (nextIndex) => {
        if (!track) return;
        index = (nextIndex + slides.length) % slides.length;
        track.style.transform = 'translateX(' + (-index * 100) + '%)';
        slides.forEach((slide, idx) => {
          slide.classList.toggle('is-active', idx === index);
        });
      };

      const start = () => {
        if (slides.length <= 1) return;
        intervalId = window.setInterval(() => {
          update(index + 1);
        }, 7000);
      };

      const stop = () => {
        if (intervalId) window.clearInterval(intervalId);
      };

      if (prevBtn) prevBtn.addEventListener('click', () => {
        stop();
        update(index - 1);
        start();
      });
      if (nextBtn) nextBtn.addEventListener('click', () => {
        stop();
        update(index + 1);
        start();
      });

      slider.addEventListener('mouseenter', stop);
      slider.addEventListener('mouseleave', start);
      update(0);
      start();
    }

    const typeFilter = document.getElementById('filter-type');
    const venueFilter = document.getElementById('filter-venue');
    const cityFilter = document.getElementById('filter-city');
    const countyFilter = document.getElementById('filter-county');
    const cards = Array.from(document.querySelectorAll('[data-show]'));
    const pageSize = 15;
    let visibleCount = pageSize;
    const loadMoreWrap = document.getElementById('load-more');
    const loadMoreBtn = document.getElementById('load-more-btn');

    function applyFilters(options){
      const resetVisible = options && options.resetVisible;
      const typeValue = typeFilter?.value || '';
      const venueValue = venueFilter?.value || '';
      const cityValue = cityFilter?.value || '';
      const countyValue = countyFilter?.value || '';
      const filtered = cards.filter(card => {
        const type = card.getAttribute('data-type') || '';
        const venue = card.getAttribute('data-venue') || '';
        const city = card.getAttribute('data-city') || '';
        const county = card.getAttribute('data-county') || '';

        return (
          (!typeValue || type === typeValue) &&
          (!venueValue || venue === venueValue) &&
          (!cityValue || city === cityValue) &&
          (!countyValue || county === countyValue)
        );
      });

      cards.forEach(card => {
        card.style.display = 'none';
      });

      const totalCount = filtered.length;
      if (resetVisible) {
        visibleCount = pageSize;
      }
      if (visibleCount > totalCount) visibleCount = totalCount;

      const pageItems = filtered.slice(0, visibleCount);
      pageItems.forEach(card => {
        card.style.display = 'flex';
      });

      const grid = document.getElementById('show-grid');
      if(grid){
        const existing = grid.querySelector('.empty');
        if(totalCount === 0 && !existing){
           const empty = document.createElement('div');
           empty.className = 'empty';
           empty.textContent = 'No shows match those filters.';
           grid.appendChild(empty);
        } else if(totalCount > 0 && existing){
           existing.remove();
        }
      }

      updateLoadMore(totalCount);
    }

    function updateLoadMore(totalCount){
      if(!loadMoreWrap || !loadMoreBtn) return;
      if(totalCount === 0 || visibleCount >= totalCount){
        loadMoreWrap.style.display = 'none';
        return;
      }
      loadMoreWrap.style.display = 'flex';
      loadMoreBtn.disabled = false;
    }

    function resetLocationFilters(except){
      if(except !== venueFilter && venueFilter) venueFilter.value = '';
      if(except !== cityFilter && cityFilter) cityFilter.value = '';
      if(except !== countyFilter && countyFilter) countyFilter.value = '';
    }

    if(typeFilter){
      typeFilter.addEventListener('change', () => {
        applyFilters({ resetVisible: true });
      });
    }

      [venueFilter, cityFilter, countyFilter].forEach(filter => {
      if(filter){
        filter.addEventListener('change', () => {
          resetLocationFilters(filter);
          applyFilters({ resetVisible: true });
        });
      }
    });
    if(loadMoreBtn){
      loadMoreBtn.addEventListener('click', () => {
        if(loadMoreBtn.disabled) return;
        loadMoreBtn.disabled = true;
        loadMoreBtn.classList.add('is-loading');
        window.setTimeout(() => {
          visibleCount += pageSize;
          loadMoreBtn.classList.remove('is-loading');
          applyFilters();
        }, 350);
      });
    }

    applyFilters({ resetVisible: true });
  })();
  </script>
  ${editorScript}
</body>
</html>
  `);
});

export default router;
