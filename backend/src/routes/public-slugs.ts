import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

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

function readStorefrontCartCount(req: any, storefront: string) {
  const raw = req.cookies?.[`storefront_cart_${storefront}`];
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((sum, item) => sum + Math.max(1, Number(item?.qty || 1)), 0);
  } catch {
    return 0;
  }
}

// Helper to match the SSR brand logic
function getPublicBrand() {
  const name = String(process.env.PUBLIC_BRAND_NAME || 'TixAll').trim();
  const defaultLocalLogo = '/IMG_2374.jpeg'; 
  const logoUrl = String(process.env.PUBLIC_BRAND_LOGO_URL ?? '').trim() || defaultLocalLogo;
  const homeHref = String(process.env.PUBLIC_BRAND_HOME_HREF || '/public').trim();
  return { name, logoUrl, homeHref };
}

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

  return res.redirect(301, `/public/${show.organiser.storefrontSlug}/${show.slug}`);
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
  req.url = `/event/${show.id}?_internal=1`;
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
      eventCategory: true,
      externalTicketUrl: true,
      usesExternalTicketing: true,
      venue: { select: { name: true, city: true } },
      ticketTypes: {
        select: { pricePence: true, available: true },
        orderBy: { pricePence: 'asc' },
        take: 1
      }
    },
  });

  const title = organiser.companyName || organiser.name || organiser.storefrontSlug;
  const brand = getPublicBrand();
  const storefrontSlug = organiser.storefrontSlug || "";
  const cartCount = storefrontSlug ? readStorefrontCartCount(req, storefrontSlug) : 0;
  const cartHref = storefrontSlug ? `/store/${escAttr(storefrontSlug)}/cart` : "/store";

  const visibleShows = shows.filter(show => !!show.slug);
  const featuredShows = visibleShows.slice(0, 6);
  const unique = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean).map(value => value.trim()))).sort();

  const venueLabels = unique(
    visibleShows.map(show => show.venue?.name || "Venue TBC")
  );
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
          data-type="${escHtml(show.eventCategory || "")}">
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
            <div class="show-card__actions">
              <a class="btn btn--primary" href="${escAttr(quickBookHref)}"${quickBookAttrs}>Quick book</a>
              <a class="btn btn--ghost" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}">More info</a>
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
          <div class="hero-media">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(show.title)}" />`
                : `<div class="hero-placeholder" aria-hidden="true"></div>`
            }
          </div>
          <div class="featured-content">
            <span class="hero-eyebrow">Featured show</span>
            <h2>${escHtml(show.title || "Featured show")}</h2>
            <p class="hero-meta">
              ${escHtml(dateStr)}
              ${showVenueName ? ` • ${escHtml(show.venue?.name || "Venue TBC")}` : ""}
            </p>
            <p class="hero-summary">${escHtml(summary)}</p>
            <div class="hero-actions">
              <a class="btn btn--primary" href="${escAttr(quickBookHref)}"${quickBookAttrs}>Quick book</a>
              <a class="btn btn--ghost" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}">More info</a>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const typeOptions = unique(visibleShows.map(show => show.eventCategory || ""));

  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} – Events</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800;900&display=swap" rel="stylesheet">
 <style>
:root {
  --app-header-h: 64px;
  --bg-page: #F3F4F6;
  --bg-surface: #FFFFFF;
  --primary: #0F172A;
  --brand: #0f9cdf;
  --brand-hover: #0b86c6;
  --text-main: #111827;
  --text-muted: #6B7280;
  --border: #E5E7EB;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding-top: var(--app-header-h);
  font-family: 'Inter', sans-serif;
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
  max-width: 1200px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
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
  font-family: 'Outfit', sans-serif;
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
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  text-decoration: none;
  color: var(--text-main);
  border: 1px solid transparent;
}
.app-action:hover {
  border-color: var(--border);
  background: #f8fafc;
}
.app-action svg {
  width: 18px;
  height: 18px;
}
.app-action-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.7rem;
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
  padding: 28px 20px 18px;
  position: relative;
}

.hero-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: left;
}

.hero-title {
  font-family: 'Outfit', sans-serif;
  font-weight: 900;
  font-size: clamp(2.6rem, 6vw, 4.5rem);
  margin: 0 0 10px;
  color: var(--primary);
}

/* --- FEATURED SLIDER --- */
.featured-section {
  max-width: 1200px;
  margin: -10px auto 40px;
  padding: 0 20px;
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
  font-family: 'Outfit', sans-serif;
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
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  margin: 0 0 16px;
  color: var(--primary);
}

/* --- MAIN CONTENT --- */
.wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px 80px;
  position: relative;
  z-index: 20;
}

/* --- FILTERS --- */
.filters-bar {
  background: var(--bg-surface);
  padding: 16px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
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
  transform: translateY(-4px);
  box-shadow: var(--shadow-float);
}

.show-card__image {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  background: #e2e8f0;
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
  font-size: 0.85rem;
  color: var(--brand);
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
  background: var(--brand);
  color: #fff;
  border: 1px solid transparent;
  box-shadow: 0 4px 6px rgba(15, 156, 223, 0.2);
}
.btn--primary:hover {
  background: var(--brand-hover);
  transform: translateY(-1px);
}

.btn--ghost {
  background: white;
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

@media (max-width: 768px) {
  .app-header-inner { padding: 0 16px; }
  .hero-section { padding: 24px 16px 20px; }
  .hero-title { font-size: 2.2rem; }
  .hero-slide { grid-template-columns: 1fr; padding: 20px; }
  .featured-section { margin-top: -10px; }
  .filters-bar { flex-direction: column; align-items: stretch; gap: 12px; }
  .card-actions { width: 100%; }
  .card-actions .btn { flex: 1; }
}
</style>
</head>
<body>

  <header class="app-header">
    <div class="app-header-inner">
      <a href="${escAttr(brand.homeHref || '#')}" class="app-brand" aria-label="${escAttr(brand.name)}">
        <img class="app-brand-logo" src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.name)}" />
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
        <a class="app-action" href="/login" aria-label="Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 1 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
      </div>
    </div>
  </header>

  <section class="hero-section">
    <div class="hero-content">
      <h1 class="hero-title">What's On</h1>
    </div>
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
    <h2 class="section-heading">All shows</h2>
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label" for="filter-date">Date</label>
        <select id="filter-date" class="filter-select">
          <option value="all">Any date</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label" for="filter-type">Category</label>
        <select id="filter-type" class="filter-select">
          <option value="">All categories</option>
          ${typeOptions.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="show-grid" id="show-grid">
      ${cards || `<div class="empty">No live events scheduled at the moment.</div>`}
    </div>
  </div>  
  
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

    const dateFilter = document.getElementById('filter-date');
    const typeFilter = document.getElementById('filter-type');
    const cards = Array.from(document.querySelectorAll('[data-show]'));

    function matchesDate(iso, filter){
      if(!filter || filter === 'all') return true;
      const date = new Date(iso);
      const now = new Date();
      if(filter === 'today'){
        return date.toDateString() === now.toDateString();
      }
      if(filter === 'week'){
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return date >= start && date < end;
      }
      if(filter === 'month'){
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      return true;
    }

    function applyFilters(){
      const dateValue = dateFilter?.value || 'all';
      const typeValue = typeFilter?.value || '';
      let visibleCount = 0;
      
      cards.forEach(card => {
        const date = card.getAttribute('data-date') || '';
        const type = card.getAttribute('data-type') || '';

        const show = 
          matchesDate(date, dateValue) &&
          (!typeValue || type === typeValue);

        // Use 'flex' to maintain card height/structure
        card.style.display = show ? 'flex' : 'none'; 
        if(show) visibleCount += 1;
      });

      const grid = document.getElementById('show-grid');
      if(grid){
        const existing = grid.querySelector('.empty');
        if(visibleCount === 0 && !existing){
           const empty = document.createElement('div');
           empty.className = 'empty';
           empty.textContent = 'No shows match those filters.';
           grid.appendChild(empty);
        } else if(visibleCount > 0 && existing){
           existing.remove();
        }
      }
    }

    [dateFilter, typeFilter].forEach(f => {
      if(f) f.addEventListener('change', applyFilters);
    });
  })();
</script>
</body>
</html>
  `);
});

export default router;
