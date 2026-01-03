
// backend/src/routes/public-event-ssr.ts
import { Router } from 'express';
import { ShowStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { readCustomerSession } from '../lib/customer-auth.js';
import { readStorefrontCartCount } from '../lib/storefront-cart.js';
import { verifyJwt } from '../utils/security.js';

const router = Router();
const THEME_CACHE_TTL_MS = 30 * 1000;
const themeCache = new Map<string, { expires: number; data: any | null }>();

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

function normaliseHexColor(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  return `#${match[1].toLowerCase()}`;
}

function normaliseRgbColor(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const rgbMatch = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  const tuple = rgbMatch ? rgbMatch.slice(1) : raw.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/)?.slice(1);
  if (!tuple) return null;
  const nums = tuple.map((n) => Math.max(0, Math.min(255, Number(n))));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return `rgb(${nums.join(', ')})`;
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

const defaultStorefrontTheme: StorefrontTheme = {
  tokens: {
    fontFamily: 'Inter',
    bannerBg: '#0B1220',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    pageBg: '#F3F4F6',
    cardBg: '#FFFFFF',
    text: '#0F172A',
    mutedText: '#6B7280',
    borderRadius: 16,
  },
  copy: {
    allEventsTitle: "What's On",
    allEventsSubtitle: 'Upcoming events',
    eventPageCtaText: 'Book Tickets',
    eventPageFromLabel: 'From',
  },
  footer: { sections: [] },
  assets: { logoUrl: '' },
};

function buildStorefrontTheme(raw: any): StorefrontTheme {
  const theme: StorefrontTheme = {
    tokens: { ...defaultStorefrontTheme.tokens },
    copy: { ...defaultStorefrontTheme.copy },
    footer: { sections: [] },
    assets: { ...defaultStorefrontTheme.assets },
  };
  const tokenKeys = Object.keys(theme.tokens) as Array<keyof StorefrontTheme['tokens']>;
  const copyKeys = Object.keys(theme.copy) as Array<keyof StorefrontTheme['copy']>;

  if (raw && typeof raw === 'object') {
    const tokens = raw.tokens || {};
    const copy = raw.copy || {};
    const assets = raw.assets || {};

    tokenKeys.forEach((key) => {
      if (key === 'borderRadius') {
        const parsed = Number(tokens[key]);
        if (!Number.isNaN(parsed)) {
          theme.tokens.borderRadius = Math.min(32, Math.max(0, parsed));
        }
        return;
      }
      const value = String(tokens[key] ?? '').trim();
      if (value) {
        theme.tokens[key as Exclude<keyof StorefrontTheme['tokens'], 'borderRadius'>] = value;
      }
    });

    copyKeys.forEach((key) => {
      const value = String(copy[key] ?? '').trim();
      if (value) {
        theme.copy[key] = value;
      }
    });

    const logoUrl = String(assets.logoUrl ?? '').trim();
    if (logoUrl) theme.assets.logoUrl = logoUrl;

    if (Array.isArray(raw.footer?.sections)) {
      theme.footer.sections = raw.footer.sections
        .filter((section: any) => section && typeof section === 'object')
        .map((section: any) => ({
          title: String(section.title ?? '').trim(),
          items: Array.isArray(section.items)
            ? section.items.map((item: any) => String(item ?? '').trim()).filter(Boolean)
            : [],
        }));
    }
  }

  return theme;
}

function getThemeCopyOverrides(raw: any) {
  if (raw && typeof raw === 'object' && raw.copy && typeof raw.copy === 'object') {
    return raw.copy as Partial<StorefrontTheme['copy']>;
  }
  return {};
}

function getThemeFooterSections(theme: StorefrontTheme) {
  return theme.footer.sections
    .map((section) => ({
      title: String(section.title || '').trim(),
      items: (section.items || []).map((item) => String(item || '').trim()).filter(Boolean),
    }))
    .filter((section) => section.title || section.items.length);
}

function renderThemeFooter(
  sections: Array<{ title: string; items: string[] }>,
  editorRegionAttr: (label: string) => string,
  editorOverlay: (label: string) => string
) {
  if (!sections.length) return '';
  return `
  <div class="widget-footer theme-footer"${editorRegionAttr('Footer')}>
    <div class="theme-footer__grid">
      ${sections
        .map(
          (section) => `
          <div class="theme-footer__column">
            ${section.title ? `<h4 class="theme-footer__title">${esc(section.title)}</h4>` : ''}
            ${
              section.items.length
                ? `<ul class="theme-footer__list">
                  ${section.items.map((item) => `<li>${esc(item)}</li>`).join('')}
                </ul>`
                : ''
            }
          </div>
        `
        )
        .join('')}
    </div>
    ${editorOverlay('Footer')}
  </div>
  `;
}

function renderThemeVars(theme: StorefrontTheme) {
  return `<style id="storefront-theme-vars">
  :root{
    --theme-font-family: ${esc(theme.tokens.fontFamily)};
    --theme-banner-bg: ${esc(theme.tokens.bannerBg)};
    --theme-primary: ${esc(theme.tokens.primary)};
    --theme-primary-text: ${esc(theme.tokens.primaryText)};
    --theme-page-bg: ${esc(theme.tokens.pageBg)};
    --theme-card-bg: ${esc(theme.tokens.cardBg)};
    --theme-text: ${esc(theme.tokens.text)};
    --theme-muted-text: ${esc(theme.tokens.mutedText)};
    --theme-radius: ${esc(String(theme.tokens.borderRadius))}px;
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
  const editorRequested = String(req.query?.editor || '') === '1';
  if (!editorRequested) return false;

  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'ORGANISER') return true;

  const token = String(req.query?.token || req.query?.editorToken || '').trim();
  if (!token) return false;

  const payload = await verifyJwt<EditorTokenPayload>(token);
  if (!payload) return false;

  const isEditorToken = payload.type === 'storefront-editor' || payload.scope === 'storefront-editor' || payload.editor === true;
  if (!isEditorToken) return false;
  if (payload.organiserId && payload.organiserId !== organiserId) return false;
  if (payload.storefrontSlug && storefrontSlug && payload.storefrontSlug !== storefrontSlug) return false;

  return true;
}

function getPublicBrand(overrides?: { name?: string | null; logoUrl?: string | null; homeHref?: string | null; color?: string | null }) {
  const name = String(process.env.PUBLIC_BRAND_NAME || 'TixAll').trim();

  // Default to the same local logo used on the checkout topbar
  // (served by your Express swqatic as "/IMG_2374.jpeg")
  const defaultLocalLogo = '/IMG_2374.jpeg';

  const logoUrl =
    String(process.env.PUBLIC_BRAND_LOGO_URL ?? '').trim() || defaultLocalLogo;

  const homeHref = String(process.env.PUBLIC_BRAND_HOME_HREF || '/public').trim();
  const resolvedName = String(overrides?.name || name).trim() || name;
  const resolvedLogo = String(overrides?.logoUrl || logoUrl).trim() || logoUrl;
  const resolvedHome = String(overrides?.homeHref || homeHref).trim() || homeHref;
  const resolvedColor = overrides?.color || null;
  return { name: resolvedName, logoUrl: resolvedLogo, homeHref: resolvedHome, color: resolvedColor };
}


// --- formatting helpers ---
function pFmt(p: number | null | undefined) {
 return '£' + (Number(p || 0) / 100).toFixed(2);
}
function pDec(p: number | null | undefined) {
 return (Number(p || 0) / 100).toFixed(2);
}
function cleanDesc(s: string | null | undefined) {
 if (!s) return '';
 return s.replace(/\s+/g, ' ').trim().slice(0, 300);
}
function esc(s: any) {
 return String(s ?? '').replace(/[<>&]/g, (c) => {
   if (c === '<') return '&lt;';
   if (c === '>') return '&gt;';
   return '&amp;';
 });
}
function escAttr(s: any) {
 // escape + make it safe inside attributes
 return esc(s).replace(/"/g, '&quot;');
}
function escJSON(obj: any) {
 // prevent </script> breakouts inside JSON-LD
 return JSON.stringify(obj).replace(/</g, '\\u003c');
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

function sanitiseRichHtml(input: string) {
 let html = String(input ?? '');

 // 1) kill scripts/styles entirely
 html = html.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
 html = html.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');

 // 2) remove inline styling + classes (this is what carries “pasted fonts”)
 html = html.replace(/\sstyle=(?:"[^"]*"|'[^']*')/gi, '');
 html = html.replace(/\sclass=(?:"[^"]*"|'[^']*')/gi, '');

 // 3) remove event handler attrs (onclick, onload, etc.)
 html = html.replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, '');

 // 4) drop font/span tags (common Word/Docs carry-over)
 html = html.replace(/<\s*\/?\s*font[^>]*>/gi, '');
 html = html.replace(/<\s*\/?\s*span[^>]*>/gi, '');

 // 5) convert divs into paragraphs (keeps spacing clean)
 html = html.replace(/<\s*div[^>]*>/gi, '<p>');
 html = html.replace(/<\s*\/\s*div\s*>/gi, '</p>');

 // 6) neutralise javascript: links
 html = html.replace(/\shref=(?:"javascript:[^"]*"|'javascript:[^']*')/gi, ' href="#"');

 return html;
}

function renderDescriptionHTML(raw: any) {
 const text = String(raw ?? '').trim();
 if (!text) return '<p>Full details coming soon.</p>';

 // If it already looks like HTML from your editor, keep structure but strip pasted styling/fonts
 if (/[<][a-z][\s\S]*[>]/i.test(text)) {
   const cleanedHtml = sanitiseRichHtml(text).trim();
   return cleanedHtml || '<p>Full details coming soon.</p>';
 }

 // Otherwise treat as plain text and keep paragraph spacing
 const cleaned = text
   .replace(/\r\n/g, '\n')
   .replace(/[ \t]+\n/g, '\n')
   .replace(/\n{3,}/g, '\n\n')
   .trim();

 const paras = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
 return paras.map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
}

function getAccessibilityReasons(accessibility: any): string[] {
 if (!accessibility) return [];

 const add = (set: Set<string>, label: string) => {
   if (label && label.trim()) set.add(label.trim());
 };

 const niceLabelFromKey = (k: string) => {
   const cleaned = k
     .replace(/_/g, ' ')
     .replace(/([a-z])([A-Z])/g, '$1 $2')
     .trim();
   return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
 };

 const matches = (s: string, patterns: string[]) => {
   const key = s.toLowerCase().replace(/[^a-z0-9]/g, '');
   return patterns.some((p) => key.includes(p));
 };

 const labels = new Set<string>();

 const handleString = (s: string) => {
   const raw = String(s || '');
   if (!raw.trim()) return;

   // common accessibility options (covers your “4 options” setup)
   if (matches(raw, ['wheelchair', 'wheelchairspace', 'wheelchairspaces', 'wheelchairaccessible', 'wheelchairaccess'])) add(labels, 'Wheelchair spaces');
   else if (matches(raw, ['stepfree', 'stepfreeaccess'])) add(labels, 'Step-free access');
   else if (matches(raw, ['accessibletoilet', 'accessibletoilets', 'accessiblewc', 'accessiblebathroom'])) add(labels, 'Accessible toilets');
   else if (matches(raw, ['hearingloop', 'assistivelistening'])) add(labels, 'Hearing loop');
   else add(labels, raw.trim());
 };

 const walk = (node: any) => {
   if (!node) return;

   if (Array.isArray(node)) {
     node.forEach(walk);
     return;
   }

   if (typeof node === 'string') {
     handleString(node);
     return;
   }

   if (typeof node === 'object') {
     for (const [k, v] of Object.entries(node)) {
       // if key itself indicates an option and value is truthy → include
       if (isTruthyFeature(v)) {
         if (matches(k, ['wheelchair', 'wheelchairspace', 'wheelchairspaces', 'wheelchairaccessible', 'wheelchairaccess'])) add(labels, 'Wheelchair spaces');
         else if (matches(k, ['stepfree', 'stepfreeaccess'])) add(labels, 'Step-free access');
         else if (matches(k, ['accessibletoilet', 'accessibletoilets', 'accessiblewc', 'accessiblebathroom'])) add(labels, 'Accessible toilets');
         else if (matches(k, ['hearingloop', 'assistivelistening'])) add(labels, 'Hearing loop');
         else add(labels, niceLabelFromKey(k));
       }

       // also walk children (in case structure nests)
       walk(v);
     }
   }
 };

 walk(accessibility);

 return Array.from(labels);
}

function ordinalSuffix(n: number) {
  const j = n % 10;
  const k = n % 100;
  if (k >= 11 && k <= 13) return 'th';
  if (j === 1) return 'st';
  if (j === 2) return 'nd';
  if (j === 3) return 'rd';
  return 'th';
}

function formatShortDate(d: Date | null) {
  if (!d) return '';
  const wd = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = d.getDate();
  const mon = d.toLocaleDateString('en-GB', { month: 'short' });
  const yr = d.getFullYear();
  return `${wd} ${day}${ordinalSuffix(day)} ${mon} ${yr}`;
}

function formatTimeHHMM(raw: any) {
 if (raw === null || raw === undefined) return '';
 const parts = String(raw).split(':');
 if (!parts.length) return String(raw);
 const h = Number(parts[0]);
 const m = Number(parts[1] || 0);
 if (Number.isNaN(h) || Number.isNaN(m)) return String(raw);
 const d = new Date();
 d.setHours(h);
 d.setMinutes(m);
 d.setSeconds(0);
 d.setMilliseconds(0);
 return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isTruthyFeature(val: any) {
 if (val === true) return true;
 if (typeof val === 'number') return val > 0;
 if (Array.isArray(val)) return val.some(isTruthyFeature);
 if (val && typeof val === 'object') return Object.values(val).some(isTruthyFeature);
 if (typeof val === 'string') {
   const s = val.trim().toLowerCase();
   if (!s) return false;
   return ['yes', 'true', 'y', '1', 'available', 'enabled'].includes(s);
 }
 return false;
}

function hasAccessibleFeatures(accessibility: any) {
 if (!accessibility) return false;

 const keywordMatches = (input: string) => {
   const key = input.toLowerCase().replace(/[^a-z0-9]/g, '');
   const keys = [
     'wheelchair',
     'wheelchairspaces',
     'wheelchairspace',
     'wheelchairaccessible',
     'wheelchairaccess',
     'stepfree',
     'stepfreeaccess',
     'accessibletoilet',
     'accessibletoilets',
     'accessiblebathroom',
     'accessiblebathrooms',
     'accessiblewc',
   ];
   return keys.some((k) => key.includes(k));
 };

 if (Array.isArray(accessibility)) {
   return accessibility.some((entry) => {
     if (typeof entry === 'string' && keywordMatches(entry)) return true;
     if (entry && typeof entry === 'object' && hasAccessibleFeatures(entry)) return true;
     return false;
   });
 }

 for (const [key, value] of Object.entries(accessibility)) {
   if (keywordMatches(key) && isTruthyFeature(value)) return true;
   if (typeof value === 'string' && keywordMatches(value) && isTruthyFeature(value)) return true;
 }

 return false;
}


function outwardCode(postcode: string | null | undefined) {
 if (!postcode) return '';
 return String(postcode).trim().split(' ')[0]?.toUpperCase() || '';
}

function scoreVenueProximity(baseVenue: any, candidateVenue: any) {
 if (!baseVenue || !candidateVenue) return 0;
 if (baseVenue.id && candidateVenue.id && baseVenue.id === candidateVenue.id) return 4;

 const baseOut = outwardCode(baseVenue.postcode);
 const candOut = outwardCode(candidateVenue.postcode);
 if (baseOut && candOut && baseOut === candOut) return 3;

 const baseCity = String(baseVenue.city || '').trim().toLowerCase();
 const candCity = String(candidateVenue.city || '').trim().toLowerCase();
 if (baseCity && candCity && baseCity === candCity) return 2;

 const baseName = String(baseVenue.name || '').trim().toLowerCase();
 const candName = String(candidateVenue.name || '').trim().toLowerCase();
 if (baseName && candName && baseName === candName) return 1;

 return 0;
}

router.get('/checkout/success', async (req, res) => {
 const orderId = String(req.query.orderId || '').trim();
 const base = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');

 if (!orderId) return res.status(400).send('Missing orderId');

 try {
   const order = await prisma.order.findFirst({
     where: { id: orderId },
      include: {
        show: {
          include: {
            organiser: {
              select: {
                storefrontSlug: true,
                companyName: true,
                name: true,
                brandLogoUrl: true,
                brandColorHex: true,
                brandColorRgb: true
              }
            },
            venue: { select: { name: true, address: true, city: true, postcode: true } },
          },
        },
      },
   });

   if (!order || !order.show) return res.status(404).send('Order not found');

   const show: any = order.show as any;
   const venue: any = (show.venue || {}) as any;

   const dateObj = show.date ? new Date(show.date) : null;
   const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
   const fullDate = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date TBC';
   const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

   const title = String(show.title || 'Your event');
   const poster = show.imageUrl || '';
   const venueLine = [venue.name, venue.city].filter(Boolean).join(', ');
   const fullAddress = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');
   const storefrontSlug = show.organiser?.storefrontSlug || '';
   const accountHref = storefrontSlug ? `/public/${encodeURIComponent(storefrontSlug)}/account` : '/public/account';

   const canonical = base ? `${base}/public/checkout/success?orderId=${encodeURIComponent(orderId)}` : `/public/checkout/success?orderId=${encodeURIComponent(orderId)}`;

   const amountPounds = (Number((order as any).amountPence || 0) / 100).toFixed(2);
   const qty = Number((order as any).quantity || 0);
   const status = String((order as any).status || '');

   // If webhook hasn’t flipped it to PAID yet, refresh a few times.
   const shouldRefresh = status !== 'PAID';

   const brand = getPublicBrand({
     name: show.organiser?.companyName || show.organiser?.name || show.organiser?.storefrontSlug,
     logoUrl: show.organiser?.brandLogoUrl,
     homeHref: storefrontSlug ? `/public/${encodeURIComponent(storefrontSlug)}` : '/public',
     color: show.organiser ? resolveBrandColor(show.organiser) : null
   });
   const logoUrl = brand.logoUrl;


   res.type('html').send(`<!doctype html>
<html lang="en">
<head>
 <meta charset="utf-8" />
 <meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Order received | ${esc(title)}</title>
 <meta name="robots" content="noindex,nofollow" />
 <link rel="canonical" href="${escAttr(canonical)}" />

 <link rel="preconnect" href="https://fonts.googleapis.com">
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800;900&display=swap" rel="stylesheet">

 ${shouldRefresh ? `<meta http-equiv="refresh" content="3">` : ''}

 <style>
   :root {
   --app-header-h: 64px;
     --bg-page: #F3F4F6;
     --bg-surface: #FFFFFF;
     --primary: #0F172A;
     --brand: ${escAttr(brand.color || '#0f9cdf')};
--brand-hover: ${escAttr(brand.color || '#0b86c6')};
     --text-main: #111827;
     --text-muted: #6B7280;
     --border: #E5E7EB;
     --radius-lg: 16px;
     --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
     --shadow-card: 0 2px 10px rgba(0,0,0,0.06);
   }
   * { box-sizing: border-box; }
body {
 margin: 0;
 padding-top: var(--app-header-h);
 font-family: 'Inter', sans-serif;
 background: var(--bg-page);
 color: var(--text-main);
}
   h1,h2,.font-heading { font-family:'Outfit', sans-serif; margin:0; line-height:1.1; }
   .wrap { max-width: 980px; margin: 0 auto; padding: 28px 16px 70px; }
   .hero {
background: var(--brand);
     border-radius: var(--radius-lg);
     overflow: hidden;
     box-shadow: var(--shadow-float);
     border: 1px solid rgba(255,255,255,0.06);
     position: relative;
     min-height: 280px;
     display:flex;
     align-items:flex-end;
   }
   .hero-bg {
     position:absolute; inset:0;
     background-image: url('${escAttr(poster)}');
     background-size: cover;
     background-position: center;
     opacity: 0.9;
   }
   .hero-overlay {
     position:absolute; inset:0;
     background:
       linear-gradient(to right, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.55) 55%, rgba(15,23,42,0.25) 100%),
       linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.3) 55%, rgba(15,23,42,0.1) 100%);
   }
   .hero-inner { position:relative; z-index:2; padding: 26px; color:#fff; width:100%; }
   .pill {
     display:inline-block; padding: 6px 10px; border-radius: 999px;
background: rgba(15,156,223,0.18); border: 1px solid rgba(15,156,223,0.35);
     color: rgba(255,255,255,0.9); font-weight:700; font-size: 12px; letter-spacing: 0.03em;
     text-transform: uppercase;
   }
   .title { margin-top: 10px; font-size: clamp(2rem, 3vw, 2.7rem); font-weight: 900; text-transform: uppercase; }
   .sub { margin-top: 10px; color: rgba(255,255,255,0.9); font-weight: 600; }
   .grid { display:grid; gap: 16px; margin-top: 18px; grid-template-columns: 1fr; }
   @media (min-width: 900px) { .grid { grid-template-columns: 1.2fr 0.8fr; } }
   .card {
 background: var(--bg-surface);
 border: 1px solid var(--border);
 border-radius: var(--radius-lg);
 box-shadow: var(--shadow-card);
 padding: 18px;
}

   .kv { margin-top: 6px; }
   .kv div { margin: 8px 0; color: var(--text-muted); }
   .kv strong { color: var(--text-main); }
   .warn { margin-top: 10px; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px 12px; border-radius: 10px; font-weight: 600; }
   .btns { display:flex; flex-wrap:wrap; gap: 10px; margin-top: 12px; }
   a.btn {
     display:inline-block; padding: 10px 14px; border-radius: 10px; font-weight: 800; text-decoration:none;
     text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.85rem;
   }
   a.primary { background: var(--brand); color: #fff; }
   a.primary:hover { background: var(--brand-hover); }
   a.ghost { background: #fff; border: 2px solid var(--border); color: var(--primary); }
   a.ghost:hover { border-color: var(--brand); color: var(--brand); }
   .small { margin-top: 10px; color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; }
   /* --- FIXED TOP HEADER (white, like checkout) --- */
.app-header{
 position: fixed;
 top: 0; left: 0; right: 0;
 height: var(--app-header-h);
 background: rgba(255,255,255,0.95);
 backdrop-filter: saturate(180%) blur(10px);
 -webkit-backdrop-filter: saturate(180%) blur(10px);
 z-index: 500;
 border-bottom: 1px solid var(--border);
}

.app-header-inner{
 max-width: 980px; /* match success page wrap width */
 height: 100%;
 margin: 0 auto;
 padding: 0 16px;
 display: flex;
 align-items: center;
 justify-content: flex-start;
 gap: 18px;
}

.app-brand{
 display: inline-flex;
 align-items: center;
 gap: 10px;
 min-width: 120px;
}

.app-brand{
  cursor: default;
  pointer-events: none;
}
.app-brand *{
  pointer-events: none;
}

.app-brand-logo{
 height: 31px;
 width: auto;
 display: block;
 border-radius: 10px;
}

.app-brand-text{
 font-family: var(--theme-font-family, 'Outfit'), sans-serif;
 font-weight: 900;
 letter-spacing: 0.02em;
 color: var(--primary);
 text-transform: uppercase;
 font-size: 1.05rem;
 line-height: 1;
}

.app-nav{
 display: flex;
 align-items: center;
 gap: 10px;
 min-width: 0;
 color: var(--text-muted);
 font-weight: 700;
 letter-spacing: 0.02em;
}

.app-nav a{ color: var(--text-muted); }
.app-nav a:hover{ color: var(--primary); }

.app-nav-sep{
 color: rgba(107,114,128,0.6);
 font-weight: 800;
}

.app-nav-current{
 color: var(--primary);
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 max-width: 55vw;
}

.app-actions{
 margin-left: auto;
 display: flex;
 align-items: center;
 gap: 10px;
}
.app-action{
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
.app-action:hover{
 border-color: var(--border);
 background: #f8fafc;
}
.app-action svg{
 width: 23px;
 height: 23px;
}
.app-action-badge{
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
.app-action-badge.is-hidden{ display: none; }

 </style>
</head><body>
 <header class="app-header">
 <div class="app-header-inner">
  <div class="app-brand" aria-label="${escAttr(brand.name)}">
  <img class="app-brand-logo" src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.name)}" />
</div>
 </div>
</header>

 <div class="wrap">


   <div class="hero">
     <div class="hero-bg"></div>
     <div class="hero-overlay"></div>
     <div class="hero-inner">
<div class="pill">${status === 'PAID' ? 'Order confirmed' : 'Order received'}</div>
       <h1 class="title">You’re booked in!</h1>
       <div class="sub">Order reference: <strong>${esc(orderId)}</strong></div>
     </div>
   </div>

   <div class="grid">
     <div class="card">
       <h2 class="font-heading" style="font-size:1.25rem;">Your tickets</h2>

${shouldRefresh ? `<div class="warn">Order received — we’re processing your payment now. This page will refresh automatically. We’ll email your receipt and ticket(s) once payment has been confirmed.</div>` : ''}

       <div class="kv">
         <div><strong>Event:</strong> ${esc(title)}</div>
         <div><strong>When:</strong> ${esc(dayName)} ${esc(fullDate)} at ${esc(timeStr)}</div>
         <div><strong>Venue:</strong> ${esc(venueLine)}</div>
         <div><strong>Address:</strong> ${esc(fullAddress)}</div>
         <div><strong>Tickets:</strong> ${esc(qty)}</div>
         <div><strong>Total paid:</strong> £${esc(amountPounds)}</div>
       </div>

       <div class="btns">
         <a class="btn ghost" href="/public/event/${escAttr(show.id)}">Back to event page</a>
       </div>

     <div class="small">
 ${shouldRefresh
   ? 'We’re processing your payment. Once it’s confirmed, we’ll email your receipt and ticket(s).'
   : 'Payment confirmed. We’ll email your receipt and ticket(s) shortly.'}
 If it doesn’t arrive within a couple of minutes, check your spam folder.
</div>
</div>

     <div class="card">
       <h2 class="font-heading" style="font-size:1.25rem;">Create an account</h2>
       <div class="small">
         Create an account to access tickets, manage bookings, and re-book faster next time.
       </div>

       <div class="btns">
         <a class="btn primary" href="${escAttr(accountHref)}">Sign up</a>
         <a class="btn ghost" href="${escAttr(accountHref)}">Log in</a>
       </div>
     </div>
   </div>

 </div>
</body>
</html>`);
 } catch (err: any) {
   console.error('[public-checkout-success] Error:', err);
   res.status(500).send('Server Error');
 }
});

router.get('/event/:id', async (req, res) => {

 const id = String(req.params.id || '').trim();
 const base = (process.env.SITE_BASE_URL || '').replace(/\/+$/, '');

 if (!id) return res.status(404).send('Not found');

 try {
   const show = await prisma.show.findFirst({
     where: { id },
     include: {
       organiser: {
         select: {
           id: true,
           storefrontSlug: true,
           companyName: true,
           name: true,
           brandLogoUrl: true,
           brandColorHex: true,
           brandColorRgb: true
         },
       },
       venue: {
 select: { id: true, name: true, address: true, city: true, postcode: true, bookingFeeBps: true },
},
ticketTypes: {
 // IMPORTANT: include ALL fields so any saved booking-fee fields come through
 orderBy: { pricePence: 'asc' },
},
     },
   });

   if (!show) return res.status(404).send('Event ID not found');

   // FIX: Status check (explicit string cast)
   // @ts-ignore
   const status = (show as any).status as string;

   if (status !== 'LIVE' && status !== 'live') {
      return res.status(404).send(`Event is not LIVE (Status: ${status})`);
   }

  const venue = (show.venue || {}) as any;
const ticketTypes = (show.ticketTypes || []) as any[];
const externalTicketUrl = String((show as any).externalTicketUrl || '').trim();
const usesExternalTicketing = (show as any).usesExternalTicketing === true;
const hasAvailableTickets = (ticketTypes || []).some((t) => t?.available === null || t?.available > 0);
const shouldUseExternalTickets = !!externalTicketUrl && (usesExternalTicketing || !hasAvailableTickets);

  const organiserId = String(show.organiser?.id || '');
  const editorStorefrontSlug = show.organiser?.storefrontSlug || null;
  const editorEnabled = organiserId ? await canUseEditorMode(req, organiserId, editorStorefrontSlug) : false;
  const themeRecord = await getCachedStorefrontTheme(organiserId, 'EVENT_PAGE');
  const themePayload = editorEnabled ? themeRecord?.draftJson ?? themeRecord?.publishedJson : themeRecord?.publishedJson;
  const storefrontTheme = buildStorefrontTheme(themePayload || null);
  const themeCopyOverrides = getThemeCopyOverrides(themePayload);
  const ctaText = themeCopyOverrides.eventPageCtaText ?? defaultStorefrontTheme.copy.eventPageCtaText;
  const fromLabel = themeCopyOverrides.eventPageFromLabel ?? defaultStorefrontTheme.copy.eventPageFromLabel;
  const themeLogo = storefrontTheme.assets.logoUrl
    ? storefrontTheme.assets.logoUrl
    : '';
  const footerSections = getThemeFooterSections(storefrontTheme);
  const editorRegionAttr = (label: string) =>
    editorEnabled ? ` data-editor-region="${escAttr(label)}"` : '';
  const editorOverlay = (label: string) =>
    editorEnabled
      ? `<div class="editor-overlay" aria-hidden="true"><span class="editor-overlay__label">${esc(label)}</span></div>`
      : '';
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
    : '';
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
    : '';
  const footerHtml = footerSections.length
    ? renderThemeFooter(footerSections, editorRegionAttr, editorOverlay)
    : `    <div class="widget-footer"${editorRegionAttr('Footer')}>
  <span class="secure-powered">
    <span class="secure-lock" aria-hidden="true">🔒</span>
    <span class="secure-text">Secure checkout powered by</span>
    <img class="secure-logo" src="/IMG_2374.jpeg" alt="TixAll" loading="lazy" />
  </span>
  ${editorOverlay('Footer')}
</div>`;

// Booking fee helper (used by ticket list + mobile bar)
const venueBps = Number((venue as any)?.bookingFeeBps || 0);

// Prefer explicit per-ticket fee in pence if present, otherwise use bps, otherwise venue bps.
const bookingFeePenceFor = (t: any) => {
 const base = Number(t?.pricePence || 0);

 const direct = Number(t?.bookingFeePence);
 if (Number.isFinite(direct) && direct >= 0) return Math.round(direct);

 const bps = Number(t?.bookingFeeBps);
 const useBps = (Number.isFinite(bps) && bps > 0) ? bps : venueBps;
 if (Number.isFinite(useBps) && useBps > 0) return Math.round((base * useBps) / 10000);

 return 0;
};

   // --- DATE VARIABLES ---
   const dateObj = show.date ? new Date(show.date) : null;
   const whenISO = dateObj ? dateObj.toISOString() : undefined;

   const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
   const dayNum = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric' }) : '';
   const monthName = dateObj ? dateObj.toLocaleDateString('en-GB', { month: 'long' }) : '';
   const yearNum = dateObj ? dateObj.toLocaleDateString('en-GB', { year: 'numeric' }) : '';
   const timeStr = dateObj ? dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

   const fullDate = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date TBC';
const prettyDate = `${dayName} ${dayNum} ${monthName} ${yearNum}`;
const shortDate = dateObj ? formatShortDate(dateObj) : fullDate;

// --- condensed mobile line (e.g. "Sat 20th Dec 2025") ---
const ordinal = (n: number) => {
 const s = ["th", "st", "nd", "rd"];
 const v = n % 100;
 return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const shortWeekday = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'short' }) : '';
const shortMonth = dateObj ? dateObj.toLocaleDateString('en-GB', { month: 'short' }) : '';
const dayNumber = dateObj ? Number(dateObj.toLocaleDateString('en-GB', { day: 'numeric' })) : NaN;

const prettyDateShort =
 dateObj && Number.isFinite(dayNumber)
   ? `${shortWeekday} ${ordinal(dayNumber)} ${shortMonth} ${yearNum}`
   : prettyDate;
   const venueLine = [venue.name, venue.city].filter(Boolean).join(', ');
   const fullAddress = [venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');

   const canonical = base ? `${base}/public/event/${show.id}` : `/public/event/${show.id}`;
   const poster = show.imageUrl || '';
   const desc = cleanDesc(show.description) || `Live event at ${venueLine}`;

   const rawAdditionalImages = (show as any).additionalImages;
   const additionalImages = Array.isArray(rawAdditionalImages)
     ? rawAdditionalImages.map((u: any) => String(u)).filter(Boolean)
     : [];
   const imageList = [poster, ...additionalImages].filter(Boolean);

   const tags = Array.isArray((show as any).tags)
     ? (show as any).tags.map((t: any) => String(t).trim()).filter(Boolean)
     : [];
   const keywordsMeta = tags.join(', ');

const ageGuidanceRaw = (show as any).ageGuidance as string | null;
const ageGuidance = ageGuidanceRaw ? ageGuidanceRaw.trim() : '';

const doorsOpenRaw = (show as any).doorsOpenTime as string | null;
const doorsOpenTime = doorsOpenRaw ? String(doorsOpenRaw).trim() : '';
const doorTimeDisplay = doorsOpenTime ? formatTimeHHMM(doorsOpenTime) : '';

const endTimeNoteRaw = (show as any).endTimeNote as string | null;
const endTimeNote = endTimeNoteRaw ? endTimeNoteRaw.trim() : '';

 const storefrontSlug = show.organiser?.storefrontSlug || '';
 const storefrontRecord = storefrontSlug
   ? await prisma.storefront.findUnique({ where: { slug: storefrontSlug } })
   : null;
 const cartCount =
   storefrontSlug && storefrontRecord
     ? await getBasketCountForStorefront(req, storefrontSlug, storefrontRecord.id)
     : 0;
 const cartHref = storefrontSlug ? `/public/${encodeURIComponent(storefrontSlug)}/basket` : '/public/basket';
 const accountHref = storefrontSlug ? `/public/${encodeURIComponent(storefrontSlug)}/account` : '/public/account';

   let doorTimeIso: string | undefined;
 if (doorsOpenTime && dateObj) {
 const [dh, dm] = String(doorsOpenTime).split(':');
     const hNum = Number(dh);
     const mNum = Number(dm || 0);
     if (!Number.isNaN(hNum) && !Number.isNaN(mNum)) {
       const d = new Date(dateObj);
       d.setHours(hNum, mNum, 0, 0);
       doorTimeIso = d.toISOString();
     }
   }

  const accessibility = ((show as any).accessibility || null) as any;
const accessibilityReasons = getAccessibilityReasons(accessibility);
const isDisabledFriendly = accessibilityReasons.length > 0 || hasAccessibleFeatures(accessibility);


   const baseEventType = (show as any).eventType || null;

  // --- PRICE VARIABLES ---

   const cheapest = ticketTypes[0];
   const fromPrice = cheapest ? pFmt(cheapest.pricePence) : undefined;

   // Mobile bar needs the same "+ £x.xx b.f." as the other price displays
   // (assumes bookingFeePenceFor(t) already exists in your file from the earlier changes)
   const fromFeePence = cheapest ? bookingFeePenceFor(cheapest) : 0;
const fromFeeHtml = fromFeePence > 0 ? `+ ${esc(pFmt(fromFeePence))}<sup class="fee-asterisk">*</sup>` : '';
// --- MOBILE CTA LOGIC ---
// We only scroll to the SSR ticket list when:
// - show is allocated (has a seating map)
// - AND there are multiple ticket types (General/OAP/Student etc)
// Because those are different "entry points" into the SAME map.
const showIdEnc = encodeURIComponent(String(id));

const seatMapKey = (t: any) =>
 t?.seatMapId ??
 t?.seatmapId ??
 t?.seatingMapId ??
 t?.seatTemplateId ??
 t?.mapId ??
 null;

const seatMapIds = (ticketTypes || []).map(seatMapKey).filter(Boolean);
const isAllocatedSeating = seatMapIds.length > 0;
const hasMultipleTicketTypes = (ticketTypes || []).length > 1;

const shouldScrollToTicketList = isAllocatedSeating && hasMultipleTicketTypes;

const mobileCtaLabel = esc(ctaText);
const mobileCtaHtml =
 shouldUseExternalTickets
   ? `<a href="${escAttr(externalTicketUrl)}" class="btn-mob-cta" data-editor-copy="eventPageCtaText" target="_blank" rel="noopener">${mobileCtaLabel}</a>`
   : !ticketTypes.length
     ? `<a href="javascript:void(0)" class="btn-mob-cta" data-editor-copy="eventPageCtaText" data-scroll-to="main-tickets">${mobileCtaLabel}</a>`
     : shouldScrollToTicketList
       ? `<a href="javascript:void(0)" class="btn-mob-cta" data-editor-copy="eventPageCtaText" data-scroll-to="main-tickets">${mobileCtaLabel}</a>`
       : `<a href="/checkout?showId=${showIdEnc}" class="btn-mob-cta" data-editor-copy="eventPageCtaText">${mobileCtaLabel}</a>`;

   // Schema.org
   const offers = ticketTypes.map((t) => ({
     '@type': 'Offer',
     name: t.name,
     price: pDec(t.pricePence),
     priceCurrency: 'GBP',
     availability: (t.available === null || t.available > 0) ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut'
   }));

   const jsonLd = {
     '@context': 'https://schema.org',
     '@type': 'Event',
     name: show.title,
     description: desc,
     startDate: whenISO,
     image: imageList.length ? imageList : undefined,
     doorTime: doorTimeIso,
     keywords: keywordsMeta || undefined,
     location: {
       '@type': 'Place',
       name: venue.name || 'Venue',
       address: venue.address
     },
     offers,
     url: canonical,
   };

   const mapQuery = encodeURIComponent([venue.name, venue.address, venue.city, venue.postcode].filter(Boolean).join(', '));
   // Using an embed iframe URL instead of a direct link for the preview
   const mapEmbedUrl = `https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
   const mapLink = `https://maps.google.com/maps?q=${mapQuery}`;

   const organiserIdForRelated = organiserId || ((show as any).organiserId as string | null);
let relatedShows: any[] = [];

// We use these to prioritise "same category/type" before going further afield
const baseCategory = ((show as any).eventCategory || null) as string | null;
const baseType = ((show as any).eventType || null) as string | null;

if (organiserIdForRelated) {
  const now = new Date();

  const others = await prisma.show.findMany({
    where: {
      organiserId: organiserIdForRelated,
      id: { not: show.id },
      status: ShowStatus.LIVE,
      // Only suggest upcoming shows
      date: { gte: now },
    },
    include: {
      venue: { select: { id: true, name: true, address: true, city: true, postcode: true } },
    },
    orderBy: { date: 'asc' },
    take: 50, // fetch more, then rank intelligently
  });

  relatedShows = others
    .map((o: any) => {
      const locScore = scoreVenueProximity(venue, o.venue);

      // Category > type (you’ve got both fields on Show)
      const catScore = baseCategory && o.eventCategory === baseCategory ? 2 : 0;
      const typeScore = baseType && o.eventType === baseType ? 1 : 0;

      const dateVal = o.date ? new Date(o.date).getTime() : Number.MAX_SAFE_INTEGER;

      return {
        ...o,
        _locScore: locScore,
        _catScore: catScore,
        _typeScore: typeScore,
        _dateVal: dateVal,
      };
    })
    .sort((a: any, b: any) => {
      // 1) same venue / same outward code / same city etc
      // 2) same category
      // 3) same type
      // 4) soonest date
      return (
        (b._locScore - a._locScore) ||
        (b._catScore - a._catScore) ||
        (b._typeScore - a._typeScore) ||
        (a._dateVal - b._dateVal)
      );
    })
    .slice(0, 10); // carousel feels better with more than 5
}

   // Helper to generate ticket list HTML
   const renderTicketList = (isMainColumn = false) => {
 if (shouldUseExternalTickets) {
   const label = usesExternalTicketing
     ? 'Buy tickets on external site'
     : 'Sold out here — buy on external site';
   const rowClass = isMainColumn ? 'ticket-row main-col-row' : 'ticket-row widget-row';
   return `
     <a href="${escAttr(externalTicketUrl)}" class="${rowClass}" target="_blank" rel="noopener">
       <div class="t-main">
         <div class="t-name">External tickets</div>
         <div class="t-availability">${esc(label)}</div>
       </div>

       <div class="t-action">
         <div class="t-price-line"></div>
         <div class="btn-buy" data-editor-copy="eventPageCtaText">${esc(ctaText)}</div>
       </div>
     </a>
   `;
 }
 if (!ticketTypes.length) {
   return '<div style="padding:20px; text-align:center; font-size:0.9rem; color:var(--text-muted);">Tickets coming soon</div>';
 }

 return ticketTypes.map((t: any) => {
   const avail = (t.available === null || t.available > 0);
   const rowClass = isMainColumn ? 'ticket-row main-col-row' : 'ticket-row widget-row';

   const bfPence = bookingFeePenceFor(t);
const bfHtml = bfPence > 0 ? `<span class="t-fee">+ ${esc(pFmt(bfPence))}<sup class="fee-asterisk">*</sup></span>` : '';

   return `
     <a href="${avail ? `/checkout?showId=${encodeURIComponent(String(id))}&ticketId=${encodeURIComponent(String(t.id))}` : '#'}" class="${rowClass}" ${!avail ? 'style="pointer-events:none; opacity:0.6;"' : ''}>
       <div class="t-main">
         <div class="t-name">${esc(t.name)}</div>
         <div class="t-availability">${avail ? 'Available' : 'Unavailable'}</div>
       </div>

       <div class="t-action">
         <div class="t-price-line">
           <span class="t-price">${esc(pFmt(t.pricePence))}</span>
           ${bfHtml}
         </div>
         <div class="btn-buy" data-editor-copy="eventPageCtaText">${esc(ctaText)}</div>
       </div>
     </a>
   `;
 }).join('');
};

   const renderRelatedShows = () => {
  if (!relatedShows.length) {
    return editorEnabled
      ? `<div class="related-carousel"${editorRegionAttr('Tiles')} style="min-height: 120px;" aria-label="Related shows placeholder">${editorOverlay('Tiles')}</div>`
      : '';
  }

  return `
  <div class="related-carousel"${editorRegionAttr('Tiles')}>
    <span class="section-label">Other shows you may be interested in</span>

    <div class="related-frame" data-related>
      <button class="related-nav related-left" type="button" aria-label="Previous shows">‹</button>
      <div class="related-strip" data-related-strip aria-label="Other shows you may be interested in">
        ${relatedShows
          .map((ev: any) => {
            const v = (ev.venue || {}) as any;
            const rDate = ev.date ? new Date(ev.date) : null;
            const rDatePretty = rDate ? formatShortDate(rDate) : 'Date TBC';

            const locLine = [v.name, v.city].filter(Boolean).join(', ');
            const img = ev.imageUrl || '';

            return `
            <a class="related-item" href="/public/event/${escAttr(ev.id)}" aria-label="${escAttr(ev.title || 'Event')}">
              <div class="related-imgWrap">
                ${img ? `<img class="related-img" src="${escAttr(img)}" alt="${escAttr(ev.title || 'Event poster')}" loading="lazy" />` : `<div class="related-imgPh"></div>`}
              </div>
              <div class="related-meta">
                <div class="related-title">${esc(ev.title || 'Event')}</div>
                <div class="related-sub">${esc(locLine)}${locLine ? ' • ' : ''}${esc(rDatePretty)}</div>
              </div>
            </a>`;
          })
          .join('')}
      </div>
      <button class="related-nav related-right" type="button" aria-label="Next shows">›</button>
    </div>
    ${editorOverlay('Tiles')}
  </div>`;
};

   const brand = getPublicBrand({
     name: show.organiser?.companyName || show.organiser?.name || show.organiser?.storefrontSlug,
     logoUrl: show.organiser?.brandLogoUrl,
     homeHref: storefrontSlug ? `/public/${encodeURIComponent(storefrontSlug)}` : '/public',
     color: show.organiser ? resolveBrandColor(show.organiser) : null
   });
   const logoUrl = themeLogo || brand.logoUrl;

   // --- RENDER HTML ---
   res.type('html').send(`<!doctype html>
<html lang="en">
<head>
 <meta charset="utf-8" />
 <meta name="viewport" content="width=device-width,initial-scale=1" />
 <title>${esc(show.title)} | Tickets</title>
 <meta name="description" content="${escAttr(desc)}" />
 ${keywordsMeta ? `<meta name="keywords" content="${escAttr(keywordsMeta)}" />` : ''}

 <link rel="preconnect" href="https://fonts.googleapis.com">
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800;900&display=swap" rel="stylesheet">
 ${themeVars}

 <script type="application/ld+json">${escJSON(jsonLd)}</script>
<script>
(function () {
 try {
   // Stop Safari restoring scroll position on refresh / back-forward cache
   if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

   function toTop() { window.scrollTo(0, 0); }

   // If the URL ever contains #main-tickets, remove it so refresh won't jump down
   function stripTicketsHash() {
     if (location.hash === '#main-tickets') {
       history.replaceState(null, '', location.pathname + location.search);
     }
   }

   document.addEventListener('DOMContentLoaded', function () {
     stripTicketsHash();

     // Always start from the top
     requestAnimationFrame(toTop);
     setTimeout(toTop, 0);
     setTimeout(toTop, 60);
     setTimeout(toTop, 250);

     // Smooth-scroll buttons without changing the URL
     document.querySelectorAll('[data-scroll-to]').forEach(function (el) {
       el.addEventListener('click', function () {
         var id = el.getAttribute('data-scroll-to');
         var target = id ? document.getElementById(id) : null;
         if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
       });
     });
   });

   // iOS Safari pageshow (bfcache) can restore old scroll after load
   window.addEventListener('pageshow', function () {
     stripTicketsHash();
     setTimeout(toTop, 0);
     setTimeout(toTop, 60);
   });
 } catch (e) {}
})();

(function () {
  const root = document.querySelector('[data-related]');
  if (!root) return;

  const strip = root.querySelector('[data-related-strip]');
  const left = root.querySelector('.related-left');
  const right = root.querySelector('.related-right');
  if (!strip || !left || !right) return;

  function update() {
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    const atStart = strip.scrollLeft <= 1;
    const atEnd = strip.scrollLeft >= maxScroll - 1;
    left.hidden = atStart;
    right.hidden = atEnd || maxScroll <= 1;
  }

  function scrollByPage(dir) {
    const card = strip.querySelector('.related-item');
    const step = card ? card.getBoundingClientRect().width + 14 : 320;
    strip.scrollBy({ left: dir * step * 3, behavior: 'smooth' });
  }

  left.addEventListener('click', () => scrollByPage(-1));
  right.addEventListener('click', () => scrollByPage(1));
  strip.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
</script>

 <style>
 :root {
   --app-header-h: 64px;

   /* Keep header + content perfectly aligned */
   --page-max: 1200px;
   --page-pad: 24px;

     /* TiXALL Blue Palette */
     --bg-page: var(--theme-page-bg, #F3F4F6);
     --bg-surface: var(--theme-card-bg, #FFFFFF);
     --primary: var(--theme-text, #0F172A);
--brand: var(--theme-primary, ${escAttr(brand.color || '#0f9cdf')});
--brand-hover: var(--theme-primary, ${escAttr(brand.color || '#0b86c6')});
     --text-main: var(--theme-text, #111827);
     --text-muted: var(--theme-muted-text, #6B7280);
     --border: #E5E7EB;
     --radius-md: var(--theme-radius, 12px);
     --radius-lg: var(--theme-radius, 16px);
--shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-card: 0 2px 10px rgba(0,0,0,0.06);
   }

   * { box-sizing: border-box; }

 body {
 margin: 0;
 padding-top: var(--app-header-h);
 font-family: var(--theme-font-family, 'Inter'), sans-serif;
 background-color: var(--bg-page);
 color: var(--text-main);
 -webkit-font-smoothing: antialiased;
}

   h1, h2, h3, h4, .font-heading { font-family: var(--theme-font-family, 'Outfit'), sans-serif; font-weight: 700; line-height: 1.1; margin: 0; }
   a { color: inherit; text-decoration: none; transition: opacity 0.2s; }
   a:hover { opacity: 0.8; }

   /* --- HERO SECTION (NO CROP: image always fully visible) --- */
.hero{
  position: relative;
  background: var(--theme-banner-bg, var(--primary));
  color: var(--theme-primary-text, #fff);
  overflow: hidden;
  isolation: isolate;   /* creates a clean stacking context */
}



/* hero poster is now an IMG so it can keep aspect ratio */
.hero-bg{
  display: block;
  width: 100%;
  height: auto;            /* grows naturally until max-height kicks in */
  max-height: 75vh;        /* your cap */
  object-fit: contain;     /* no crop while it can still grow */
  background: var(--primary);

  /* for the “slow zoom” behaviour on wide screens */
  transform: none;
  transform-origin: center;
  transition: transform 280ms ease;
}


/* if max-height ever kicks in, keep the full image visible */
@media (min-width: 960px){
 .hero-bg{ object-position: center; }
}

/* Wide screens: once the image would otherwise pillarbox, switch to cover and gently zoom */
@media (min-width: 1100px){
  .hero-bg{
    width: 100%;
    height: 75vh;          /* stop growing taller */
    max-height: 75vh;
    object-fit: cover;     /* fill width, no side bars */
    object-position: center;
    transform: scale(1.03); /* start gentle zoom */
  }
}

/* progressively zoom a touch more on very wide viewports */
@media (min-width: 1400px){
  .hero-bg{ transform: scale(1.07); }
}
@media (min-width: 1700px){
  .hero-bg{ transform: scale(1.12); }
}
@media (min-width: 2000px){
  .hero-bg{ transform: scale(1.16); }
}


.hero-media{
  position: relative;
  z-index: 1;           /* ensures strip z-index wins cleanly */
  line-height: 0;       /* prevents tiny baseline gaps */
  background: var(--primary);
}

.hero-bg{
  position: relative;
  z-index: 1;
}

.hero-overlay{
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(to right,
      rgba(15,23,42,0.10) 0%,
      rgba(15,23,42,0.05) 55%,
      rgba(15,23,42,0.00) 100%
    ),
    linear-gradient(to top,
      rgba(15,23,42,0.12) 0%,
      rgba(15,23,42,0.04) 45%,
      rgba(15,23,42,0.00) 80%
    );
}

/* Desktop meta must be above overlay */
.hero-content{
  z-index: 3;
}

/* Strip + its text must sit above everything (and not be affected by overlay) */
.hero-strip{
  display: block;         /* ALWAYS ON */
  width: 100%;
  background: #1d1c1a;    /* REQUIRED COLOUR */
  border-top: 0;          /* remove hairline */

  /* hide sub-pixel seams by overlapping the image by 1px */
  position: relative;
  top: -1px;
}

/* soft blend from image into strip (reduced ~95%) */
.hero-strip::before{
  content:'';
  position:absolute;
  left:0; right:0;
  top:-6px;
  height:6px;
  pointer-events:none;
  background: linear-gradient(
    to bottom,
    rgba(15,23,42,0.00) 0%,
    rgba(15,23,42,0.05) 100%
  );
}

.hero-strip-inner,
.hero-strip *{
  position: relative;
  z-index: 11; /* belt + braces: text always on top */
}
  /* --- FIXED TOP HEADER (white, like checkout) --- */
.app-header{
 position: fixed;
 top: 0; left: 0; right: 0;
 height: var(--app-header-h);
 background: rgba(255,255,255,0.95);
 backdrop-filter: saturate(180%) blur(10px);
 -webkit-backdrop-filter: saturate(180%) blur(10px);
 z-index: 500;
 border-bottom: 1px solid var(--border);
}

.app-header-inner{
 max-width: var(--page-max);
 height: 100%;
 margin: 0 auto;
 padding: 0 var(--page-pad);
 display: flex;
 align-items: center;
 justify-content: flex-start;
 gap: 18px;
}

.app-brand{
 display: inline-flex;
 align-items: center;
 gap: 10px;
 min-width: 120px;
}

.app-brand-logo{
  height: 33.15px; /* 44.2px * 0.75 = 33.15px (25% smaller) */
  width: auto;
  display: block;
  border-radius: 10px;
}

.app-brand-text{
 font-family: var(--theme-font-family, 'Outfit'), sans-serif;
 font-weight: 900;
 letter-spacing: 0.02em;
 color: var(--primary);
 text-transform: uppercase;
 font-size: 1.05rem;
 line-height: 1;
}

.app-nav{
 display: flex;
 align-items: center;
 gap: 10px;
 min-width: 0;
 color: var(--text-muted);
 font-weight: 700;
 letter-spacing: 0.02em;
}

.app-nav a{ color: var(--text-muted); }
.app-nav a:hover{ color: var(--primary); }

.app-nav-sep{
 color: rgba(107,114,128,0.6);
 font-weight: 800;
}

.app-nav-current{
 color: var(--primary);
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 max-width: 55vw;
}

@media (max-width: 960px){
 .app-header-inner{ padding: 0 16px; }
 .app-nav-current{ max-width: 45vw; }
}
 .hero-content{
 position: absolute;
 left: 0; right: 0; bottom: 0;
 z-index: 10;
 width: 100%;
 max-width: var(--page-max);
 margin: 0 auto;
 padding: 24px var(--page-pad) 18px;
 display: grid;
 gap: 16px;
}

/* --- MOBILE HERO STRIP (full-width, under the image) --- */
/* --- MOBILE HERO STRIP (full-width, under the image) --- */
.hero-strip{
  display: block;         /* ALWAYS ON */
  width: 100%;
  background: #1d1c1a;    /* REQUIRED COLOUR */
  border-top: 1px solid rgba(255,255,255,0.004); /* keep your subtle line */
  position: relative;
  z-index: 50;

  /* kill any faint seam by overlapping into the image */
  margin-top: -2px;
}
.hero-strip-inner{
  max-width: 1200px;
  margin: 0 auto;

  /* default (larger) padding */
  padding: 12px 16px;

  display: flex;
  align-items: center;
  gap: 12px;

  color: rgba(255,255,255,0.95);
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.1;

  white-space: nowrap;
  overflow: hidden; /* keep the bar tidy */
}

/* IMPORTANT: no ellipses at all — we change content instead */
.hs-item{
  display: inline-block;
  white-space: nowrap;
}

/* date variants */
.hs-date--short{ display: none; }
.hs-date--long{ display: inline-block; }

/* keep time stable on the right */
.hs-time{
  margin-left: auto;
  text-align: right;
}

/* separators */
.hs-sep{
  width: 4px;
  height: 18px;
  border-radius: 999px;
  background: var(--brand);
  flex: 0 0 auto;
}

/* 1) When screen shrinks enough that we'd wrap: switch to abbreviated date */
@media (max-width: 720px){
  .hs-date--long{ display: none; }
  .hs-date--short{ display: inline-block; }

  /* tighten the bar so it doesn't feel "gappy" */
  .hero-strip-inner{
    padding: 10px 14px;
    font-size: 0.92rem;
    gap: 10px;
  }
}

/* 2) Even smaller: drop venue entirely, leaving "Sat 20th Dec 2025" + time */
@media (max-width: 520px){
  .hs-venue{ display: none; }
  .hs-sep--1{ display: none; } /* separator before venue */
  .hs-sep--2{ display: none; } /* separator after venue */

  /* even tighter on tiny screens */
  .hero-strip-inner{
    padding: 9px 12px;
    font-size: 0.9rem;
    gap: 8px;
  }
}

   .hero-title {
     font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 800; line-height: 1; text-transform: uppercase;
     letter-spacing: -0.02em; max-width: 800px; text-shadow: 0 4px 30px rgba(0,0,0,0.6);
   }
  .hero-meta {
 display: flex; flex-wrap: wrap; gap: 18px; margin-top: 8px; font-size: 1.05rem; font-weight: 500;
 color: rgba(255,255,255,0.95); text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.hero-meta-item{
 display: flex;
 align-items: center;
 gap: 8px;
 position: relative;
 padding-left: 16px; /* space for the divider */
}

.hero-meta-item:first-child{
 padding-left: 0;
}

.hero-meta-item:not(:first-child)::before{
 content: '';
 position: absolute;
 left: 0;
 top: 50%;
 transform: translateY(-50%);
 width: 4px;
 height: 18px;
 border-radius: 999px;
 background: var(--brand);
}

   .hero-meta-icon { color: var(--brand); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }

  /* --- TITLE (Left column, under hero) --- */
.page-title-row{
 margin: 0 0 22px;
}

  .page-title-row{ margin: 0 0 12px; }

.page-title{
 font-family: 'Outfit', sans-serif;
 font-weight: 900;
 text-transform: uppercase;
 letter-spacing: -0.02em;
 font-size: clamp(1.8rem, 3.2vw, 3.1rem);
 line-height: 1.05;
 color: var(--primary);
 margin: 0;
}


/* On desktop, keep the title in the LEFT column so it sits “between” content + widget */
@media (min-width: 960px){
 .below-hero-inner{
   grid-template-columns: 1fr 380px;
   align-items: end;
 }
 .page-title{
   grid-column: 1 / 2;
   padding-right: 10px;
 }
}

/* --- LAYOUT CONTAINER --- */
.layout {
 max-width: var(--page-max);
 margin: 0 auto;
 padding: 18px var(--page-pad) 80px; /* gap under hero */
 display: grid;
 gap: 48px;
 position: relative;
 z-index: 20;
}

@media (min-width: 960px) {
 .layout {
   grid-template-columns: 1fr 380px;
   margin-top: 0; /* keep layout clean now title is outside hero */
 }
}

/* --- MAIN CONTENT COLUMN --- */
.content-area {
 display: flex; flex-direction: column; gap: 48px;
 padding-top: 24px; /* title now creates the “breathing room” */
}


   .section-label {
     font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;
     color: var(--text-muted); margin-bottom: 16px; display: block;
     border-left: 4px solid var(--brand); padding-left: 12px;
   }
   .rich-text { font-size: 1.1rem; line-height: 1.7; color: #334155; }

/* Force consistent site font inside description (stops pasted fonts) */
.rich-text, .rich-text * {
 font-family: 'Inter', sans-serif !important;
}

.rich-text p { margin: 0 0 1.5em; }
.rich-text p:last-child { margin-bottom: 0; }

.rich-text ul, .rich-text ol {
 margin: 0 0 1.5em;
 padding-left: 1.25rem;
}
.rich-text li { margin: 0.35em 0; }

  /* Info (no box/shadow) */
.info-inline{
 margin-top: 48px; /* match the rhythm between major sections */
 display:flex;
 flex-wrap:wrap;
 gap: 22px;
}
.info-inline-item{ display:flex; flex-direction:column; }
.info-inline-label{
 font-size: 0.78rem;
 letter-spacing: 0.08em;
 text-transform: uppercase;
 font-weight: 700;
 color: var(--text-muted);
}
.info-inline-value{
 font-size: 1rem;
 font-weight: 700;
 color: var(--primary);
 margin-top: 2px;
}

.gallery-wrap{ position:relative; margin-top: 48px; }
.gallery-strip{
 display:flex;
 gap:12px;
 overflow-x:auto;
 scroll-snap-type:x mandatory;
 padding-bottom: 2px;
 scrollbar-width: none; /* Firefox */
}
.gallery-strip::-webkit-scrollbar{ display:none; } /* Chrome/Safari */

.gallery-strip-item{
 flex: 0 0 auto;
 min-width: 260px;
 max-width: 360px;
 aspect-ratio: 16/9;
 border-radius: 10px;
 overflow: hidden;
 box-shadow: var(--shadow-card);
 scroll-snap-align: start;
 background: #e2e8f0;
}
.gallery-strip-img{ width:100%; height:100%; object-fit:cover; transition: transform 0.4s; }
.gallery-strip-item:hover .gallery-strip-img{ transform: scale(1.03); }

.gallery-nav{
 position:absolute;
 top: 50%;
 transform: translateY(-50%);
 width: 40px;
 height: 40px;
 border-radius: 999px;
 border: 1px solid var(--border);
 background: rgba(255,255,255,0.92);
 box-shadow: 0 6px 18px rgba(0,0,0,0.12);
 display:flex;
 align-items:center;
 justify-content:center;
 font-size: 22px;
 font-weight: 800;
 cursor:pointer;
 user-select:none;
}
.gallery-left{ left: -12px; }
.gallery-right{ right: -12px; }
.gallery-nav[hidden]{ display:none; }

/* Make gallery images clickable (no default button styling) */
.gallery-strip-btn{
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: zoom-in;
}
.gallery-strip-btn:focus{ outline: none; }
.gallery-strip-btn:focus-visible{
  outline: 3px solid rgba(15,156,223,0.55);
  outline-offset: 3px;
  border-radius: 12px;
}

/* --- LIGHTBOX (tap/click image to open full size) --- */
.lightbox{
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 18px;
}
.lightbox[hidden]{ display:none; }

.lightbox-backdrop{
  position: absolute;
  inset: 0;
  background: rgba(15,23,42,0.72);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.lightbox-dialog{
  position: relative;
  z-index: 1;
  max-width: min(1100px, 92vw);
  max-height: 86vh;
  display: grid;
  place-items: center;
}

.lightbox-img{
  max-width: 100%;
  max-height: 86vh;
  width: auto;
  height: auto;
  border-radius: 14px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.35);
  background: #0F172A;
}

.lightbox-close{
  position: absolute;
  top: -10px;
  right: -10px;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(15,23,42,0.75);
  color: #fff;
  font-size: 26px;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
}

.lightbox-nav{
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(15,23,42,0.62);
  color: #fff;
  font-size: 28px;
  font-weight: 900;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.lightbox-prev{ left: -14px; }
.lightbox-next{ right: -14px; }

@media (max-width: 520px){
  .lightbox{ padding: 12px; }
  .lightbox-prev{ left: -6px; }
  .lightbox-next{ right: -6px; }
}



   /* Venue Map Styles (Updated for Iframe) */
   .venue-map-container { margin-top: 24px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: var(--bg-surface); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
   .venue-map-header {
     position: relative; height: 220px; /* Taller for better map view */ background: #E2E8F0;
   }
  .venue-map-iframe {
    position: absolute; top:0; left:0; width:100%; height:100%; border:0;
    filter: none;                 /* always colour */
    transition: none;             /* no hover behaviour needed */
}
   .venue-details { padding: 20px; background: var(--bg-surface); position: relative; z-index: 2;}
   .venue-name { font-size: 1.3rem; margin-bottom: 4px; font-family: 'Outfit', sans-serif; }
   .venue-address { color: var(--text-muted); margin-bottom: 16px; }
   .btn-outline {
     display: inline-block; padding: 8px 16px; border: 2px solid var(--border);
     border-radius: 6px; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; background: var(--bg-surface);
   }
   .btn-outline:hover { border-color: var(--brand); color: var(--brand); background: var(--bg-page); }

   /* --- BOOKING WIDGET (Sidebar) --- */
  .booking-widget {
 position: sticky;
 top: calc(var(--app-header-h) + 16px);
 background: var(--bg-surface);
 border-radius: var(--radius-lg);
 box-shadow: var(--shadow-float);
 border: 1px solid var(--border);
 overflow: hidden;
}

 .accessibility-pill{
 background: var(--bg-surface);
 color: var(--primary);
 padding: 24px; /* match .widget-header */
 border-bottom: 1px solid var(--border);
}

.acc-title{
 font-size: 1.25rem;   /* match .widget-title */
 font-weight: 800;     /* match .widget-title */
 color: var(--primary);
 line-height: 1.15;
 white-space: nowrap;
}

.acc-list{
 margin-top: 8px;
 display: grid;
 gap: 6px;
}

.acc-item{
 display: flex;
 align-items: center;
 gap: 10px;
 font-size: 0.9rem;
 font-weight: 600;
 color: var(--text-muted); /* matches widget subtitle tone */
}

.acc-tick{
 color: var(--brand);
 font-weight: 900;
 font-size: 1.05rem;
 line-height: 1;
 flex: 0 0 auto;
}


   .widget-header { padding: 24px; border-bottom: 1px solid var(--border); background: var(--bg-surface); }
   .widget-title { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
   .widget-subtitle { font-size: 0.9rem; color: var(--text-muted); margin-top: 4px; font-weight: 500;}
.widget-footer{
  background: var(--bg-page);
  padding: 16px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.widget-footer.theme-footer {
  text-align: left;
  color: var(--text-main);
}

.theme-footer__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.theme-footer__title {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.theme-footer__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--text-main);
}

/* Footer “powered by” line */
.secure-powered{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;

  /* make the row behave like one “line” */
  height: 18px;
  line-height: 18px;
}

.secure-lock{
  display: inline-flex;
  align-items: center;
  line-height: 18px;
}

.secure-text{
  display: inline-flex;
  align-items: center;
  line-height: 18px;
  position: relative;
  top: 1px;               /* nudge TEXT down slightly */
}

.secure-logo{
  height: 16px;
  width: auto;
  display: inline-block;
  vertical-align: middle;
  border-radius: 4px;
}

   /* --- TICKET LIST STYLES --- */
   .ticket-list-container { padding: 8px; }
   .ticket-row {
     display: grid; grid-template-columns: 1fr auto; align-items: center;
     padding: 16px; border-radius: 8px; transition: background 0.2s, box-shadow 0.2s;
     cursor: pointer; text-decoration: none; color: inherit;
   }
   .widget-row { padding: 12px 16px; }
   .widget-row:hover { background: #F8FAFC; }
   .main-col-row { background: #fff; border: 1px solid var(--border); margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
   .main-col-row:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-color: #d1d5db; }

   .t-main { display: flex; flex-direction: column; }
   .t-name { font-weight: 700; color: var(--primary); font-size: 1rem; }
   .t-desc { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; }
   .t-action { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;}
.t-price-line { display:flex; gap:8px; align-items:baseline; justify-content:flex-end; flex-wrap:wrap; }
.t-price { font-weight: 700; color: var(--primary); font-size: 1.1rem; }
.t-fee { font-weight: 400; color: var(--text-muted); font-size: 0.95rem; }
.fee-disclaimer { margin-top: 10px; font-size: 0.9rem; color: var(--text-muted); }

.fee-asterisk{
 font-size: 0.75em;
 line-height: 0;
 vertical-align: super;
 position: relative;
 top: -0.1em; /* tiny extra lift so it sits higher */
}
   .btn-buy {
     background: var(--brand); color: var(--theme-primary-text, #fff); font-size: 0.85rem; font-weight: 700;
     padding: 8px 16px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em;
     transition: background 0.2s; white-space: nowrap;
   }
.ticket-row:hover .btn-buy { background: var(--brand-hover); box-shadow: 0 2px 8px rgba(15, 156, 223, 0.35); }
   .btn-sold {
     background: #F1F5F9; color: #94A3B8; cursor: not-allowed;
     font-size: 0.85rem; font-weight: 700; padding: 8px 16px; border-radius: 6px; text-transform: uppercase;
   }

   /* --- MOBILE FOOTER --- */
   .mobile-bar {
     display: none; position: fixed; bottom: 0; left: 0; right: 0;
     background: white; padding: 16px 20px; box-shadow: 0 -4px 20px rgba(0,0,0,0.1); z-index: 100;
     align-items: center; justify-content: space-between; border-top: 1px solid var(--border);
   }
  .mob-price { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }

.mob-line{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.mob-val { font-size: 1.2rem; font-weight: 800; color: var(--primary); }
.mob-fee { font-size: 0.95rem; font-weight: 400; color: var(--text-muted); }

.btn-mob-cta {
     background: var(--brand); color: var(--theme-primary-text, #fff); padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 1rem;
   }

   /* Related shows carousel (beneath tickets) */
.related-carousel{
  margin-top: 28px;
}

.related-frame{
  position: relative;
  max-width: calc(300px * 3 + 14px * 2);
  width: min(100%, calc(300px * 3 + 14px * 2));
}

.related-strip{
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 6px 2px 2px;
  scrollbar-width: none; /* Firefox */
}
.related-strip::-webkit-scrollbar{ display:none; }

.related-nav{
  position:absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.92);
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 22px;
  font-weight: 800;
  cursor:pointer;
  user-select:none;
  z-index: 2;
}
.related-left{ left: -12px; }
.related-right{ right: -12px; }
.related-nav[hidden]{ display:none; }

.related-item{
  flex: 0 0 auto;
  width: 260px;
  scroll-snap-align: start;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

@media (min-width: 720px){
  .related-item{ width: 300px; }
}
@media (max-width: 719px){
  .related-frame{
    max-width: calc(260px * 3 + 14px * 2);
    width: min(100%, calc(260px * 3 + 14px * 2));
  }
}

.related-imgWrap{
  width: 100%;
  aspect-ratio: 16/9;
  background: #e2e8f0;
}
.related-img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.related-imgPh{
  width: 100%;
  height: 100%;
  background: #e2e8f0;
}

.related-meta{
  padding: 12px 12px 14px;
  display: grid;
  gap: 6px;
}

.related-title{
  font-family: 'Outfit', sans-serif;
  font-weight: 900;
  font-size: 1.02rem;
  line-height: 1.15;
  text-transform: uppercase;
}

.related-sub{
  color: var(--text-muted);
  font-size: 0.92rem;
  font-weight: 600;
}
@media (max-width: 960px) {
  /* IMPORTANT: remove forced height that creates dead space */
  .hero { min-height: 0; }

  /* Hide the overlay meta on mobile (kills the “pill” look entirely) */
  .hero-content { display: none; }

  /* Show the under-image strip */
  .hero-strip { display: block; }

  .hero-overlay{ background: none !important; }

  .layout { display: block; margin-top: 0; gap: 28px; }
  .content-area { padding-top: 14px; gap: 28px; }
  .booking-area { display: none; }
  .mobile-bar { display: flex; }
}
${editorStyles}
 </style>
</head>
<body>

<header class="app-header">
 <div class="app-header-inner">
  <div class="app-brand"${editorRegionAttr('Logo')} aria-label="${escAttr(brand.name)}">
  <img class="app-brand-logo" src="${escAttr(logoUrl)}" alt="${escAttr(brand.name)}" data-editor-logo data-default-logo="${escAttr(brand.logoUrl)}" />
  ${editorOverlay('Logo')}
</div>
  <div class="app-actions">
    <a class="app-action" href="${escAttr(cartHref)}" aria-label="View basket">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="9" cy="20" r="1"></circle>
        <circle cx="17" cy="20" r="1"></circle>
        <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"></path>
      </svg>
      <span class="app-action-badge${cartCount ? "" : " is-hidden"}">${cartCount}</span>
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

<header class="hero"${editorRegionAttr('Banner')}>

  <div class="hero-media">
    ${poster ? `<img class="hero-bg" src="${escAttr(poster)}" alt="${escAttr(show.title || 'Event poster')}" loading="eager" />` : ''}
    <div class="hero-overlay"></div>

</div>

  <!-- Mobile full-width strip (shown on mobile only) -->
  <div class="hero-strip" aria-label="Event details">
    <div class="hero-strip-inner">
      <!-- Long date (bigger screens) -->
      <span class="hs-item hs-date hs-date--long">${esc(prettyDate)}</span>
      <!-- Short date (when we'd otherwise wrap) -->
      <span class="hs-item hs-date hs-date--short">${esc(prettyDateShort)}</span>

      <span class="hs-sep hs-sep--1" aria-hidden="true"></span>

      <span class="hs-item hs-venue">${esc(venue.name)}</span>

      <span class="hs-sep hs-sep--2" aria-hidden="true"></span>

      <span class="hs-item hs-time">${esc(timeStr)}</span>
    </div>
  </div>

  ${editorOverlay('Banner')}
</header>

 <div class="layout">

  <div class="content-area">

     <div class="page-title-row"${editorRegionAttr('Headings')}>
       <h1 class="page-title">${esc(show.title)}</h1>
       ${editorOverlay('Headings')}
     </div>

     <div>
         <span class="section-label">Overview</span>
        <div class="rich-text">
 ${renderDescriptionHTML(show.description)}
</div>
<div class="fee-disclaimer"><sup class="fee-asterisk">*</sup>All ticket prices are subject to booking fees.</div>
      ${doorTimeDisplay || ageGuidance || endTimeNote ? `
<div class="info-inline">
 ${doorTimeDisplay ? `<div class="info-inline-item"><span class="info-inline-label">Doors open</span><span class="info-inline-value">${esc(doorTimeDisplay)}</span></div>` : ''}
 ${ageGuidance ? `<div class="info-inline-item"><span class="info-inline-label">Age guidance</span><span class="info-inline-value">${esc(ageGuidance)}</span></div>` : ''}
 ${endTimeNote ? `<div class="info-inline-item"><span class="info-inline-label">End time note</span><span class="info-inline-value">${esc(endTimeNote)}</span></div>` : ''}
</div>
` : ''}


          ${imageList.length ? `
 <div class="gallery-wrap" data-gallery>
   <button class="gallery-nav gallery-left" type="button" aria-label="Previous images">‹</button>
   <div class="gallery-strip" data-gallery-strip>
     ${imageList
       .map(
         (src, idx) => `
         <div class="gallery-strip-item">
           <button class="gallery-strip-btn" type="button" data-lightbox-src="${escAttr(src)}" aria-label="View image ${idx + 1}">
             <img src="${escAttr(src)}" class="gallery-strip-img" alt="Event image ${idx + 1}" />
           </button>
         </div>
         `
       )
       .join('')}
   </div>
   <button class="gallery-nav gallery-right" type="button" aria-label="Next images">›</button>
 </div>
` : ''}
     </div>

     <div>
         <span class="section-label">Location</span>
         <div class="venue-map-container">
           <div class="venue-map-header">
               <iframe class="venue-map-iframe" src="${mapEmbedUrl}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
           </div>
           <div class="venue-details">
             <h3 class="venue-name">${esc(venue.name)}</h3>
             <p class="venue-address">${esc(fullAddress)}</p>
             <a href="${escAttr(mapLink)}" target="_blank" class="btn-outline">Open in Maps ↗</a>
           </div>
         </div>
     </div>

     <div id="main-tickets"${editorRegionAttr('Buttons')}>
         <span class="section-label">Tickets</span>
         <div class="ticket-list-container" style="padding:0;">
             ${renderTicketList(true)}
         </div>
         ${editorOverlay('Buttons')}
     </div>
${renderRelatedShows()}
   </div>


   <div class="booking-area">
     <div class="booking-widget">
${isDisabledFriendly ? `
 <div class="accessibility-pill">
   <div class="acc-title">Disabled-friendly show</div>
   ${accessibilityReasons.length ? `
     <div class="acc-list">
${accessibilityReasons
 .map(
   (r) =>
     `<div class="acc-item"><span class="acc-tick" aria-hidden="true">✓</span><span>${esc(r)}</span></div>`
 )
 .join('')}
     </div>
   ` : ''}
 </div>
` : ''}
       <div class="widget-header">
         <div class="widget-title">Select Tickets</div>
         <div class="widget-subtitle">${esc(dayName)}, ${esc(fullDate)} at ${esc(timeStr)}</div>
       </div>
       <div class="ticket-list-container">
         ${renderTicketList(false)}
       </div>
${footerHtml}
     </div>
   </div>

 </div>

  <div class="mobile-bar">
   <div>
     <div class="mob-price" data-editor-copy="eventPageFromLabel">${esc(fromLabel)}</div>
     <div class="mob-line">
       <div class="mob-val">${fromPrice ? esc(fromPrice) : '£0.00'}</div>
${fromFeeHtml ? `<div class="mob-fee">${fromFeeHtml}</div>` : ''}
     </div>
   </div>
${mobileCtaHtml}
 </div> 

<!-- Lightbox (full size gallery image preview) -->
<div class="lightbox" data-lightbox hidden aria-hidden="true">
  <div class="lightbox-backdrop" data-lightbox-close></div>

  <div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="Image preview">
    <button class="lightbox-close" type="button" data-lightbox-close aria-label="Close">×</button>
    <button class="lightbox-nav lightbox-prev" type="button" data-lightbox-prev aria-label="Previous image">‹</button>

    <img class="lightbox-img" data-lightbox-img src="" alt="Image preview" />

    <button class="lightbox-nav lightbox-next" type="button" data-lightbox-next aria-label="Next image">›</button>
  </div>
</div>



<script>
(function () {
  const root = document.querySelector('[data-gallery]');
  if (!root) return;

  const strip = root.querySelector('[data-gallery-strip]');
  const left = root.querySelector('.gallery-left');
  const right = root.querySelector('.gallery-right');
  if (!strip || !left || !right) return;

  function update() {
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    const atStart = strip.scrollLeft <= 1;
    const atEnd = strip.scrollLeft >= maxScroll - 1;
    left.hidden = atStart;
    right.hidden = atEnd || maxScroll <= 1;
  }

  function scrollByCard(dir) {
    const firstCard = strip.querySelector('.gallery-strip-item');
    const step = firstCard ? firstCard.getBoundingClientRect().width + 12 : 320;
    strip.scrollBy({ left: dir * step, behavior: 'smooth' });
  }

  left.addEventListener('click', () => scrollByCard(-1));
  right.addEventListener('click', () => scrollByCard(1));
  strip.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  // ---- Lightbox ----
  const lb = document.querySelector('[data-lightbox]');
  const lbImg = lb ? lb.querySelector('[data-lightbox-img]') : null;
  const btnPrev = lb ? lb.querySelector('[data-lightbox-prev]') : null;
  const btnNext = lb ? lb.querySelector('[data-lightbox-next]') : null;

  if (!lb || !lbImg || !btnPrev || !btnNext) return;

  const items = Array.from(root.querySelectorAll('[data-lightbox-src]'));
  const srcs = items.map((el) => el.getAttribute('data-lightbox-src')).filter(Boolean);

  let current = 0;
  let prevOverflow = '';

  function setOpen(open) {
    if (open) {
      lb.hidden = false;
      lb.setAttribute('aria-hidden', 'false');
      prevOverflow = document.documentElement.style.overflow || '';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      lb.hidden = true;
      lb.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = prevOverflow;
      document.body.style.overflow = '';
    }
  }

  function render() {
    const src = srcs[current] || '';
    lbImg.src = src;

    // hide nav if only 1 image
    const many = srcs.length > 1;
    btnPrev.style.display = many ? '' : 'none';
    btnNext.style.display = many ? '' : 'none';
  }

  function openAt(idx) {
    if (!srcs.length) return;
    current = Math.max(0, Math.min(idx, srcs.length - 1));
    render();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    lbImg.src = '';
  }

  function next() {
    if (srcs.length < 2) return;
    current = (current + 1) % srcs.length;
    render();
  }

  function prev() {
    if (srcs.length < 2) return;
    current = (current - 1 + srcs.length) % srcs.length;
    render();
  }

  // Click image in gallery => open lightbox
  strip.addEventListener('click', function (e) {
    const target = e.target;
    const btn = target && target.closest ? target.closest('[data-lightbox-src]') : null;
    if (!btn) return;

    e.preventDefault();
    const idx = items.indexOf(btn);
    openAt(idx >= 0 ? idx : 0);
  });

  // Close when clicking backdrop OR close button
  lb.addEventListener('click', function (e) {
    const t = e.target;
    if (t && t.closest && t.closest('[data-lightbox-close]')) {
      e.preventDefault();
      close();
      return;
    }
    // If you clicked outside the image/dialog, close
    if (t === lb) close();
  });

  btnNext.addEventListener('click', function (e) { e.preventDefault(); next(); });
  btnPrev.addEventListener('click', function (e) { e.preventDefault(); prev(); });

  // Keyboard controls
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });

  // Simple swipe on mobile (left/right)
  let startX = 0;
  let startY = 0;
  let tracking = false;

  lbImg.addEventListener('touchstart', function (e) {
    if (lb.hidden) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    tracking = true;
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });

  lbImg.addEventListener('touchend', function (e) {
    if (!tracking || lb.hidden) return;
    tracking = false;

    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // horizontal swipe only
    if (Math.abs(dx) > 45 && Math.abs(dy) < 40) {
      if (dx < 0) next();
      else prev();
    }
  }, { passive: true });

})();
</script>
<script>
(function(){
  var showId = ${escJSON(id)};
  if (!showId) return;
  var sessionKey = 'tixall_session_id';
  var sessionId = null;
  try {
    sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(sessionKey, sessionId);
    }
  } catch (e) {}
  function sendEvent(type){
    fetch('/public/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showId: showId, type: type, sessionId: sessionId })
    }).catch(function(){});
  }
  sendEvent('VIEW');
  document.querySelectorAll('.ticket-row a, .ticket-row').forEach(function(el){
    el.addEventListener('click', function(){
      sendEvent('ADD_TO_CART');
    });
  });
  document.querySelectorAll('a[href^=\"/checkout\"], a[href*=\"/checkout?\"]').forEach(function(el){
    el.addEventListener('click', function(){
      sendEvent('CHECKOUT_START');
    });
  });
})();
</script>
${editorScript}

</body>
</html>`);
 } catch (err: any) {
   console.error('[public-event-ssr] Error:', err);
   res.status(500).send('Server Error');
 }
});

export default router;
