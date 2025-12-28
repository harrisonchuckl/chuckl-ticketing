// backend/src/routes/seating-choice.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { clampBookingFeePence } from "../lib/booking-fee.js";

const prisma = new PrismaClient();
const router = Router();

// --- Ticket suggestion helpers (last 6 months, fallback ladder) ---
function normalizeTicketName(name: string) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function median(nums: number[]) {
  if (!nums || nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildTicketSuggestions(
  rows: Array<{ name: string; pricePence: number; available: number | null; createdAt: Date }>,
  max = 4
) {
  const map = new Map<
    string,
    { display: string; count: number; prices: number[]; avails: number[]; lastSeenAt: number }
  >();

  for (const r of rows || []) {
    const display = String(r.name || "").trim();
    if (!display) continue;

    const key = normalizeTicketName(display);
    const seenAt = r.createdAt ? new Date(r.createdAt).getTime() : 0;

    const cur =
      map.get(key) || { display, count: 0, prices: [], avails: [], lastSeenAt: 0 };

    cur.count += 1;
    cur.lastSeenAt = Math.max(cur.lastSeenAt, seenAt);

    if (Number.isFinite(Number(r.pricePence))) cur.prices.push(Number(r.pricePence));
    if (r.available != null && Number.isFinite(Number(r.available))) cur.avails.push(Number(r.available));

    map.set(key, cur);
  }

  return Array.from(map.values())
    .map((x) => ({
      name: x.display,
      pricePence: Math.round(median(x.prices) || 0),
      available: x.avails.length ? Math.round(median(x.avails)) : null,
      count: x.count,
      lastSeenAt: x.lastSeenAt,
    }))
    .sort((a, b) => (b.count - a.count) || (b.lastSeenAt - a.lastSeenAt))
    .slice(0, max);
}

async function suggestTicketsForShow(show: any) {
  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const organiserId = show?.organiserId || null;
  const venueId = show?.venueId || null;

  // Note: your schema uses eventType + eventCategory
  const eventType = show?.eventType || null;
  const eventCategory = show?.eventCategory || null;

  // If we can’t scope to an organiser, never “global-any” across all users — use safe defaults.
  if (!organiserId) {
    return {
      basedOn: "defaults",
      since,
      suggestions: [
        { name: "General Admission", pricePence: 0, available: null },
        { name: "VIP", pricePence: 0, available: null },
      ].slice(0, 2),
    };
  }

  const baseShowWhere: any = {
    organiserId,
    // don’t use current show’s own ticketTypes as history
    id: { not: show.id },
    createdAt: { gte: since },
  };

  const ladder: Array<{ label: string; showWhere: any }> = [];

  // Tier 1) Same venue + same category/subcategory (when present)
  if (venueId && (eventType || eventCategory)) {
    ladder.push({
      label: "organiser+venue+category",
      showWhere: {
        ...baseShowWhere,
        venueId,
        ...(eventType ? { eventType } : {}),
        ...(eventCategory ? { eventCategory } : {}),
      },
    });
  }

  // Tier 2) Same venue (even if category/subcategory missing)
  if (venueId) {
    ladder.push({
      label: "organiser+venue",
      showWhere: {
        ...baseShowWhere,
        venueId,
      },
    });
  }

  // Tier 3) Same category/subcategory (ignore venue)
  if (eventType || eventCategory) {
    ladder.push({
      label: "organiser+category",
      showWhere: {
        ...baseShowWhere,
        ...(eventType ? { eventType } : {}),
        ...(eventCategory ? { eventCategory } : {}),
      },
    });
  }

  // Tier 4) Organiser-any (last 6 months)
  ladder.push({
    label: "organiser-any",
    showWhere: { ...baseShowWhere },
  });

  const MIN = 2; // if we can find 2 sensible ticket types, stop
  let bestLabel = "organiser-any";
  let best: Array<{ name: string; pricePence: number; available: number | null; count: number; lastSeenAt: number }> = [];

  for (const step of ladder) {
    const rows = await prisma.ticketType.findMany({
      where: {
        show: step.showWhere,
      },
      select: { name: true, pricePence: true, available: true, createdAt: true },
      take: 500,
    });

    const suggestions = buildTicketSuggestions(rows, 4);

    if (suggestions.length > best.length) {
      best = suggestions as any;
      bestLabel = step.label;
    }

    if (suggestions.length >= MIN) {
      best = suggestions as any;
      bestLabel = step.label;
      break;
    }
  }

  return {
    basedOn: bestLabel,
    since,
    suggestions: best.map(({ count, lastSeenAt, ...rest }) => rest),
  };
}

function escapeHtml(str: string | null | undefined) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Simple shared shell so both pages feel like part of the same flow.
 */
function renderShell(options: {
  title: string;
  body: string;
  stepLabel?: string;
  showId: string;
  pageClass?: string;
  hideHeaderText?: boolean;
}) {
  const { title, body, stepLabel, showId, pageClass, hideHeaderText } = options;

   const stepText = stepLabel
    ? `<div class="step-pill">${stepLabel}</div>`
    : "";

  const brandLogo = `<img class="brand-logo" src="/IMG_2374.jpeg" alt="TixAll" />`;

  const headerLeftHtml = hideHeaderText
    ? `${brandLogo}`
    : `${brandLogo}${stepText}<div class="headline">${title}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
:root {
      /* Brand */
--bg: #ffffff;            /* Admin white */
      --accent: #0f9cdf;
      --accent-strong: #0b7fb6;

      /* Surfaces */
      --card-bg: rgba(255, 255, 255, 0.96);
      --card-border: rgba(255, 255, 255, 0.28);
      --card-border-active: rgba(255, 255, 255, 0.55);
      --card-shadow: 0 18px 55px rgba(2, 25, 41, 0.22);

      /* Text */
      --text-main: #0f172a;
      --text-muted: #5b6b7f;
      --header-text: #ffffff;

      /* Pills */
      --pill-bg: rgba(255, 255, 255, 0.18);
      --pill-text: #ffffff;

      --accent-soft: rgba(255, 255, 255, 0.18);

      --radius-xl: 24px;
      --radius-lg: 18px;
      --radius-pill: 999px;
    }

    * {
      box-sizing: border-box;
    }
   html, body {
      margin: 0;
      padding: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      background: var(--bg);
      color: var(--text-main);
      height: 100%;
    }



    body {
      display: flex;
      min-height: 100vh;
      align-items: stretch;
      justify-content: center;
    }

    .page {
      width: 100%;
      max-width: 1120px;
      margin: 32px auto;
      padding: 0 24px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .page-header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

   .brand-logo {
  height: 68px; /* was 34px – double size */
  width: auto;
  display: block;
}



  /* Admin-style header (white background) */
.headline { color: var(--text-main); }
.subhead { color: var(--text-muted); }

.page-header {
  padding: 6px 4px;
}

.step-pill {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-main);
  border: 1px solid rgba(148, 163, 184, 0.35);
}

/* Give the centre column a bit more presence */
.cards-wrapper {
  width: 100%;
  max-width: 920px;
}


    .step-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: var(--pill-bg);
      color: var(--pill-text);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .headline {
      font-size: 22px;
      line-height: 1.25;
      letter-spacing: -0.02em;
      font-weight: 650;
    }

    .subhead {
      font-size: 13px;
      color: var(--text-muted);
    }

    .page-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ghost-button {
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.5);
      padding: 7px 14px;
      background: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      color: var(--text-main);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      text-decoration: none;
      backdrop-filter: blur(10px);
    }

    .ghost-button:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: #ffffff;
    }

    .ghost-button-icon {
      font-size: 13px;
    }

    .page-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cards-wrapper {
      width: 100%;
      max-width: 880px;
    }

    /* --- Step 1: two cards layout --- */

    .choice-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 32px;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .choice-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .choice-card {
      background: radial-gradient(circle at top left, #eef4ff 0, #ffffff 40%);
      border-radius: var(--radius-xl);
      border: 1px solid var(--card-border);
      box-shadow: 0 12px 35px rgba(15, 23, 42, 0.06);
      padding: 28px 24px 26px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition:
        transform 160ms ease-out,
        box-shadow 160ms ease-out,
        border-color 160ms ease-out,
        background 160ms ease-out;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .choice-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--card-shadow);
      border-color: var(--card-border-active);
      background: radial-gradient(circle at top left, #e0edff 0, #ffffff 45%);
    }

    .choice-main {
      display: flex;
      gap: 18px;
      align-items: center;
    }

    .choice-icon {
      width: 44px;
      height: 44px;
      border-radius: 18px;
      background: linear-gradient(135deg, #e0edff, #f5f7ff);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
    }

    .chip {
      font-size: 11px;
      border-radius: 999px;
      padding: 3px 9px;
      border: 1px solid rgba(148, 163, 184, 0.45);
      color: #64748b;
      background: rgba(255, 255, 255, 0.8);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .choice-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .choice-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .choice-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    .choice-footer {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      min-width: 140px;
    }

    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }

    .select-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }

    /* --- Step 2: layout wizard cards --- */

    .layout-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 28px;
      justify-content: center;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .layout-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .layout-card {
      background: radial-gradient(circle at top, #eef4ff 0, #ffffff 55%);
      border-radius: var(--radius-xl);
      border: 1px solid var(--card-border);
      box-shadow: 0 12px 35px rgba(15, 23, 42, 0.05);
      padding: 24px 22px 20px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 18px;
      transition:
        transform 160ms ease-out,
        box-shadow 160ms ease-out,
        border-color 160ms ease-out,
        background 160ms ease-out;
    }

    .layout-card:hover {
      transform: translateY(-2px);
      border-color: var(--card-border-active);
      box-shadow: var(--card-shadow);
      background: radial-gradient(circle at top, #e0edff 0, #ffffff 60%);
    }

    .layout-top {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .layout-icon {
      width: 40px;
      height: 40px;
      border-radius: 16px;
      background: linear-gradient(145deg, #e0edff, #f9fbff);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
    }

    .layout-title-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .layout-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .layout-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    .layout-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .layout-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .layout-pill {
      font-size: 11px;
      border-radius: 999px;
      padding: 3px 8px;
      border: 1px solid rgba(148, 163, 184, 0.45);
      color: #64748b;
      background: rgba(255, 255, 255, 0.9);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .layout-select-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }

    /* --- icons --- */

    .icon-grid {
      width: 20px;
      height: 20px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 1fr;
      gap: 2px;
    }

    .icon-grid span {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      background: #93c5fd;
    }

    .icon-rows {
      width: 20px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .icon-rows span {
      height: 4px;
      border-radius: 999px;
      background: #60a5fa;
    }

    .icon-mixed {
      width: 20px;
      height: 20px;
      position: relative;
    }

    .icon-mixed .block {
      position: absolute;
      border-radius: 4px;
      background: #93c5fd;
    }

    .icon-mixed .block.a {
      inset: 0 8px 8px 0;
    }

    .icon-mixed .block.b {
      inset: 8px 0 0 8px;
      background: #bfdbfe;
    }

    .icon-blank {
      width: 20px;
      height: 14px;
      border-radius: 6px;
      border: 2px solid #93c5fd;
      background: #eff6ff;
    }

/* --- Unallocated ticket editor (Eventbrite-style list + drawer) --- */

.tickets-card {
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: var(--radius-xl);
  padding: 22px;
  box-shadow: 0 14px 45px rgba(15, 23, 42, 0.08);
}

.tickets-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.tickets-header h2 {
  margin: 6px 0 4px;
  font-size: 20px;
  letter-spacing: -0.01em;
}

.eyebrow {
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  font-weight: 650;
}

.subtext {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.show-chip {
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: var(--radius-pill);
  border: 1px solid rgba(148, 163, 184, 0.35);
  display: inline-flex;
  flex-direction: column;
  min-width: 240px;
}

.chip-title { font-weight: 700; font-size: 14px; }
.chip-meta { font-size: 12px; color: var(--text-muted); }

.tickets-top-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
}

.tickets-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0 14px;
}

.ticket-row {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: var(--radius-lg);
  background: #fff;
  padding: 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: border-color 120ms ease;
}

.ticket-row:hover {
  border-color: rgba(15, 156, 223, 0.45);
}

.ticket-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ticket-name {
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ticket-meta {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.25;
}

.ticket-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ticket-price {
  font-weight: 750;
  font-size: 14px;
}

.kebab {
  width: 38px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255,255,255,0.9);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.kebab:hover {
  border-color: rgba(15, 156, 223, 0.8);
  color: rgba(15, 156, 223, 1);
}

.menu {
  position: absolute;
  right: 0;
  top: 42px;
  width: 200px;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
  padding: 6px;
  z-index: 9999;
}

.menu button {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 10px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
}

.menu button:hover {
  background: rgba(15, 23, 42, 0.05);
}

.menu .danger { color: #dc2626; }

.tickets-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.action-spacer { flex: 1; }

.primary-button {
  border-radius: var(--radius-pill);
  border: none;
  padding: 10px 16px;
  background: var(--accent);
  color: #fff;
  font-weight: 750;
  cursor: pointer;
}

.primary-button:hover { background: var(--accent-strong); }

/* Unallocated page: make buttons subtly rounded (not pill-shaped) */
.unallocated-page .ghost-button,
.unallocated-page .primary-button {
  border-radius: 10px;
}

.unallocated-page .kebab,
.unallocated-page .drawer-close {
  border-radius: 10px;
}

/* Unallocated page: subtle sizing (keep it readable, not massive) */
.unallocated-page .tickets-card { padding: 22px; }

.unallocated-page .eyebrow { font-size: 11px; }
.unallocated-page .tickets-header h2 { font-size: 22px; }
.unallocated-page .subtext { font-size: 13px; }

.unallocated-page .chip-title { font-size: 14px; }
.unallocated-page .chip-meta { font-size: 12px; }

.unallocated-page .ghost-button { font-size: 12px; padding: 8px 14px; }
.unallocated-page .primary-button { font-size: 12px; padding: 10px 16px; }

.unallocated-page .ticket-name { font-size: 14px; }
.unallocated-page .ticket-meta { font-size: 12px; }
.unallocated-page .ticket-price { font-size: 14px; }

.unallocated-page .kebab {
  width: 38px;
  height: 34px;
  font-size: 18px;
}

.unallocated-page .menu { width: 200px; }
.unallocated-page .menu button { font-size: 13px; padding: 10px 10px; }

.unallocated-page .drawer-title { font-size: 16px; }
.unallocated-page .field-label { font-size: 12px; }
.unallocated-page .input { font-size: 14px; padding: 10px 11px; }

.unallocated-page .status-row { font-size: 13px; }
.unallocated-page .fee-meta { font-size: 12px; }


.status-row {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted);
}
.status-row[data-tone="success"] { color: #0f9f6e; }
.status-row[data-tone="error"] { color: #dc2626; }

.empty {
  padding: 12px;
  background: #f8fafc;
  border: 1px dashed rgba(148, 163, 184, 0.5);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  text-align: center;
}

/* Drawer */
.drawer {
  position: fixed;
  inset: 0;
  display: none;
  z-index: 50;
}

.drawer[data-open="true"] { display: block; }

.drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.45);
}

.drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(520px, 94vw);
  height: 100%;
  background: #fff;
  border-left: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: -18px 0 45px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.drawer-title {
  font-weight: 800;
  font-size: 16px;
}

.drawer-close {
  width: 38px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #fff;
  cursor: pointer;
  font-size: 18px;
}

.drawer-body {
  padding: 14px 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.input {
  width: 100%;
  padding: 10px 11px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  font-size: 14px;
  background: #fff;
  outline: none;
}

.input:focus {
  border-color: rgba(15, 156, 223, 0.9);
  box-shadow: 0 0 0 4px rgba(15, 156, 223, 0.18);
}

.drawer-footer {
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  display: flex;
  gap: 10px;
  align-items: center;
}

.fee-meta {
  font-size: 12px;
  color: #667085;
  line-height: 1.35;
}

  </style>
</head>
<body>
  <div class="page ${pageClass || ""}">
    <header class="page-header">
      <div class="page-header-left">
        ${headerLeftHtml}
      </div>
      <div class="page-header-right">
      <a class="ghost-button" href="/admin/ui/shows/create?showId=${showId}">
  <span class="ghost-button-icon">←</span>
  <span>Back to event details</span>
</a>
      </div>
    </header>
    <main class="page-body">
      <div class="cards-wrapper">
        ${body}
      </div>
    </main>
  </div>
</body>
</html>`;

  return html;
}

/**
 * STEP 1 (of 2) — Unallocated vs Allocated seating
 * Route: GET /admin/seating-choice/:showId
 */
router.get("/seating-choice/:showId", async (req, res) => {
  const { showId } = req.params;

  // If the show already has a seating mode saved, skip this page entirely.
  try {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { usesAllocatedSeating: true },
    });

    // Only auto-skip when the value is explicitly set (true/false).
    if (show && typeof show.usesAllocatedSeating === "boolean") {
      return res.redirect(
        302,
        show.usesAllocatedSeating
          ? `/admin/seating/builder/preview/${showId}?layout=blank`
          : `/admin/seating/unallocated/${showId}`
      );
    }
  } catch (e) {
    console.error("seating-choice: failed to look up show", e);
  }

  const body = `
    <section class="choice-grid">
      <article class="choice-card" data-choice="unallocated">
        <div class="choice-main">
          <div class="choice-icon">
            <div class="icon-rows">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="choice-meta">
            <div class="choice-title">Unallocated seating</div>
            <div class="choice-desc">
              Simple tickets, no seat map. Perfect for comedy clubs and general admission events.
            </div>
          </div>
        </div>
        <div class="choice-footer">
          <div class="chip-row">
            <div class="chip">Quick to set up</div>
            <div class="chip">Best for GA rooms</div>
          </div>
          <div class="select-label">Choose this style</div>
        </div>
      </article>

      <article class="choice-card" data-choice="allocated">
        <div class="choice-main">
          <div class="choice-icon">
            <div class="icon-grid">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="choice-meta">
            <div class="choice-title">Allocated seating</div>
            <div class="choice-desc">
              Build a detailed seating map. Let customers pick exact seats by price and area.
            </div>
          </div>
        </div>
        <div class="choice-footer">
          <div class="chip-row">
            <div class="chip">Seat picker</div>
            <div class="chip">Zones &amp; price levels</div>
          </div>
          <div class="select-label">Choose this style</div>
        </div>
      </article>
    </section>

    <script>
      (function () {
        var showId = "${showId}";
        var cards = document.querySelectorAll(".choice-card");
        if (!cards || !cards.length) return;

        cards.forEach(function (card) {
          card.addEventListener("click", function () {
            var choice = card.getAttribute("data-choice");
            if (choice === "unallocated") {
              window.location.href = "/admin/seating/unallocated/" + showId;
            } else if (choice === "allocated") {
              window.location.href = "/admin/seating/builder/preview/" + showId + "?layout=blank";
            }
          });
        });
      })();
    </script>
  `;

  const html = renderShell({
    title: "How do you want to sell seats for this event?",
    body,
    stepLabel: "Step 1 of 2 · Seating style",
    showId,
  });

  res.status(200).send(html);
});

/**
 * STEP 2 (of 4) — Layout type (tables, rows, mixed, blank)
 * Route: GET /admin/seating/layout-wizard/:showId
 */
router.get("/seating/layout-wizard/:showId", (req, res) => {
  const { showId } = req.params;

  const body = `
    <section class="layout-grid">
      <article class="layout-card" data-layout="tables">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-grid">
              <span></span><span></span>
              <span></span><span></span>
            </div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Tables &amp; chairs</div>
            <div class="layout-desc">
              Cabaret-style maps with round or long tables and seats auto-generated around them.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Comedy rooms</span>
            <span class="layout-pill">Drinks &amp; tables</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>

      <article class="layout-card" data-layout="sections">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-rows">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Sections &amp; rows</div>
            <div class="layout-desc">
              Classic theatre blocks with aisles, numbered rows and fixed seating.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Stalls / circle</span>
            <span class="layout-pill">Fixed seating</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>

      <article class="layout-card" data-layout="mixed">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-mixed">
              <div class="block a"></div>
              <div class="block b"></div>
            </div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Mixed seating</div>
            <div class="layout-desc">
              Blend tables, rows and standing zones in a single flexible map.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Flexible setups</span>
            <span class="layout-pill">VIP areas</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>

      <article class="layout-card" data-layout="blank">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-blank"></div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Blank canvas</div>
            <div class="layout-desc">
              Start from an empty room and add only the tables, rows and zones you need.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Any configuration</span>
            <span class="layout-pill">Full control</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>
    </section>

    <script>
      (function () {
        var showId = "${showId}";
        var cards = document.querySelectorAll(".layout-card");
        if (!cards || !cards.length) return;

        cards.forEach(function (card) {
          card.addEventListener("click", function () {
            var layout = card.getAttribute("data-layout") || "tables";
            var url = "/admin/seating/builder/preview/" + showId + "?layout=" + layout;
            window.location.href = url;
          });
        });
      })();
    </script>
  `;

  const html = renderShell({
    title: "How would you like this room to look?",
    body,
    stepLabel: "Step 2 of 4 · Layout style",
    showId,
  });

  res.status(200).send(html);
});

/**
 * STEP 2 — Unallocated tickets editor
 * Route: GET /admin/seating/unallocated/:showId
 */
router.get("/seating/unallocated/:showId", async (req, res) => {
  const { showId } = req.params;

  try {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: { select: { id: true, name: true, city: true, capacity: true, bookingFeeBps: true } },
        ticketTypes: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!show) {
      return res.status(404).send("Show not found");
    }

  let initialTickets: {
        id?: string;
        name: string;
        price: number;
        available: string;
        onSaleAt: string;
        offSaleAt: string;
      }[] = (show.ticketTypes || []).map((t) => ({
        id: t.id,
        name: t.name,
        price: (t.pricePence || 0) / 100,
        available: t.available == null ? "" : String(t.available),
        onSaleAt: t.onSaleAt ? new Date(t.onSaleAt).toISOString() : "",
        offSaleAt: t.offSaleAt ? new Date(t.offSaleAt).toISOString() : "",
      }));

let prefillInfo: { used: boolean; basedOn?: string; since?: string } = { used: false };

// If no tickets exist yet, prefill from “most common” tickets in the last 6 months (fallback ladder)
if (!initialTickets.length) {
  try {
    const suggested = await suggestTicketsForShow(show);

     const defaultAllocationStr =
      show?.venue?.capacity != null ? String(show.venue.capacity) : "";

    if (suggested.suggestions && suggested.suggestions.length) {
      initialTickets = suggested.suggestions.map((s) => ({
        // No id -> user must click “Save tickets” to create these
        name: s.name,
        price: (Number(s.pricePence || 0) / 100),
        // Allocation is REQUIRED: use historic allocation if present; else fall back to venue capacity (if known)
        available: (s.available != null ? String(s.available) : defaultAllocationStr),
        onSaleAt: "",
        offSaleAt: "",
      }));

      prefillInfo = {
        used: true,
        basedOn: suggested.basedOn,
        since: suggested.since.toISOString(),
      };
    }
  } catch (e) {
    console.error("ticket suggestion prefill failed", e);
  }
}

    const showMeta = {
      id: show.id,
      title: show.title || "Untitled show",
      date: show.date ? new Date(show.date).toISOString() : null,
      venue: show.venue
        ? {
            id: show.venue.id,
            name: show.venue.name,
            city: show.venue.city,
            capacity: show.venue.capacity ?? null,
            bookingFeeBps: show.venue.bookingFeeBps ?? null,
          }
        : null,
    };

  const body = `
  <section class="tickets-card">
    <header class="tickets-header">
      <div>
        <div class="eyebrow">Unallocated seating</div>
        <h2>Create tickets</h2>
        <p class="subtext">Add ticket types, then click a ticket to edit details in a side panel.</p>
      </div>

      <div class="show-chip">
        <span class="chip-title">${escapeHtml(show.title || "Untitled show")}</span>
        ${
          show.venue
            ? `<span class="chip-meta">${escapeHtml(show.venue.name)}${
                show.venue.city ? " · " + escapeHtml(show.venue.city) : ""
              }</span>`
            : ""
        }
      </div>
    </header>

    <div style="margin: 10px 0 14px; color:#555; font-size: 13px; line-height: 1.35;">
      Booking fee is set per ticket price tier (minimum enforced). You can increase it per ticket (no ceiling).
      <br />
      <strong>Reminder:</strong> you receive 50% of the net booking fee per ticket sold.
    </div>

    <div class="tickets-top-actions">
      <button class="ghost-button" type="button" id="add-ticket">+ Add ticket</button>
    </div>

    <div class="tickets-list" id="tickets-list"></div>

    <div class="tickets-actions">
<button class="ghost-button" type="button" id="edit-capacity">
  Capacity: <span id="cap_label">—</span> <span aria-hidden="true">✎</span>
</button>
      <div class="action-spacer"></div>
      <button class="ghost-button" type="button" id="save-tickets">Save tickets</button>
      <button class="primary-button" type="button" id="publish">Create &amp; publish show</button>
    </div>

    <div class="status-row" id="status-row"></div>
  </section>

  <!-- Drawer -->
  <div class="drawer" id="drawer" data-open="false" aria-hidden="true">
    <div class="drawer-backdrop" id="drawer-backdrop"></div>
    <aside class="drawer-panel">
      <div class="drawer-header">
        <div class="drawer-title" id="drawer-title">Edit</div>
        <button class="drawer-close" type="button" id="drawer-close">×</button>
      </div>

      <div class="drawer-body" id="drawer-body"></div>

      <div class="drawer-footer">
        <button class="ghost-button" type="button" id="drawer-cancel">Cancel</button>
        <div class="action-spacer"></div>
        <button class="primary-button" type="button" id="drawer-done">Done</button>
      </div>
    </aside>
  </div>

  <script>
    (function () {
      var showId = ${JSON.stringify(showId)};
      var initialTickets = ${JSON.stringify(initialTickets)};
      var showMeta = ${JSON.stringify(showMeta)};
      var prefillInfo = ${JSON.stringify(prefillInfo)};

      var listEl = document.getElementById("tickets-list");
      var statusRow = document.getElementById("status-row");
            var capLabelEl = document.getElementById("cap_label");


      var drawer = document.getElementById("drawer");
      var drawerBackdrop = document.getElementById("drawer-backdrop");
      var drawerClose = document.getElementById("drawer-close");
      var drawerCancel = document.getElementById("drawer-cancel");
      var drawerDone = document.getElementById("drawer-done");
      var drawerTitle = document.getElementById("drawer-title");
      var drawerBody = document.getElementById("drawer-body");

      var defaultAllocation =
        (showMeta && showMeta.venue && showMeta.venue.capacity != null)
          ? String(showMeta.venue.capacity)
          : "";

// Capacity rules:
// - If venue capacity exists, default to that (but user can override).
// - If venue capacity is blank, default to SUM of ticket allocations (auto-updates until user overrides).
var capacityCap = (showMeta && showMeta.venue && showMeta.venue.capacity) || "";
var capacityAuto = !(capacityCap !== "" && capacityCap != null);

      // --- Booking fee tiers (min enforced; max is recommended range, NOT a cap) ---
      const BOOKING_FEE_BANDS = [
        { minPricePence: 5000, minFeePence: 550, maxFeePence: 900 },
        { minPricePence: 4000, minFeePence: 440, maxFeePence: 640 },
        { minPricePence: 3000, minFeePence: 330, maxFeePence: 530 },
        { minPricePence: 2500, minFeePence: 313, maxFeePence: 430 },
        { minPricePence: 2000, minFeePence: 250, maxFeePence: 330 },
        { minPricePence: 1500, minFeePence: 210, maxFeePence: 330 },
        { minPricePence: 1250, minFeePence: 175, maxFeePence: 290 },
        { minPricePence: 1000, minFeePence: 155, maxFeePence: 250 },
        { minPricePence: 750,  minFeePence: 133, maxFeePence: 230 },
        { minPricePence: 500,  minFeePence: 113, maxFeePence: 230 },
        { minPricePence: 250,  minFeePence: 113, maxFeePence: 170 },
        { minPricePence: 200,  minFeePence: 100, maxFeePence: 170 },
        { minPricePence: 100,  minFeePence: 79,  maxFeePence: 170 },
        { minPricePence: 0,    minFeePence: 0,   maxFeePence: 0   },
      ];

      function poundsToPence(v) {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.round(n * 100);
      }

      function penceToPoundsStr(p) {
        const n = Number(p || 0);
        return (n / 100).toFixed(2);
      }

      function getBandForPricePence(pricePence) {
        const p = Math.max(0, Math.round(Number(pricePence) || 0));
        for (const b of BOOKING_FEE_BANDS) {
          if (p >= b.minPricePence) return b;
        }
        return BOOKING_FEE_BANDS[BOOKING_FEE_BANDS.length - 1];
      }

      function clampBookingFeePenceClient(pricePence, bookingFeePence) {
        const band = getBandForPricePence(pricePence);
        const fee = Math.max(0, Math.round(Number(bookingFeePence) || 0));
        return Math.max(band.minFeePence, fee);
      }

      function bookingFeeMetaText(pricePence) {
        const band = getBandForPricePence(pricePence);
        if (band.maxFeePence === 0) return "";
        return (
          "Recommended £" + penceToPoundsStr(band.minFeePence) +
          "–£" + penceToPoundsStr(band.maxFeePence) +
          ". Minimum £" + penceToPoundsStr(band.minFeePence) +
          ". You receive 50% of the net booking fee."
        );
      }

      function ensureTicketBookingFee(t) {
        const pricePence = poundsToPence(t.price);
        const feePenceIn = poundsToPence(t.bookingFee);
        const feePenceClamped = clampBookingFeePenceClient(pricePence, feePenceIn);
        t.bookingFee = pricePence <= 0 ? 0 : Number(penceToPoundsStr(feePenceClamped));
        return { pricePence, feePenceClamped };
      }

      function pad2(n){ return String(n).padStart(2, "0"); }
      function toLocalDTInput(d){
        return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
      }

      function defaultOnSale() {
        var d = new Date();
        d.setSeconds(0,0);
        return toLocalDTInput(d);
      }

      function defaultOffSale() {
        // showMeta.date is your show start datetime
        if (!showMeta || !showMeta.date) return "";
        var d = new Date(showMeta.date);
        if (isNaN(d.getTime())) return "";
        d = new Date(d.getTime() - 60 * 60 * 1000); // minus 1 hour
        d.setSeconds(0,0);
        return toLocalDTInput(d);
      }

      function fmtMoney(pounds) {
        var n = Number(pounds || 0);
        if (!Number.isFinite(n)) n = 0;
        return "£" + n.toFixed(2);
      }

      function fmtDT(val) {
        if (!val) return "—";
        try {
          var d = new Date(val);
          if (isNaN(d.getTime())) return "—";
          return d.toLocaleString(undefined, { weekday: "short", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
        } catch(e){
          return "—";
        }
      }

      function showStatus(msg, tone) {
        if (!statusRow) return;
        statusRow.textContent = msg || "";
        statusRow.setAttribute("data-tone", tone || "");
      }

      async function jsonRequest(url, options) {
        var res = await fetch(url, options || {});
        if (!res.ok) {
          var text = "";
          try {
            var data = await res.json();
            text = (data && (data.message || data.error)) || res.statusText;
          } catch (e) {
            text = res.statusText;
          }
          throw new Error(text || "Request failed");
        }
        try { return await res.json(); } catch (e) { return null; }
      }

        function calcTotalAllocations() {
        var sum = 0;
        for (var i=0;i<tickets.length;i++){
          var v = tickets[i].available;
          // Allocation is required — if blank, treat as 0 for display maths (save will block anyway)
          if (v === "" || v == null) v = 0;
          var n = Number(v);
          if (!Number.isFinite(n) || n < 0) n = 0;
          sum += n;
        }
        return sum;
      }

      var tickets = (initialTickets || []).map(function(t){ return Object.assign({}, t); });

      // Apply default sale windows + booking fee clamp for any blank rows (including prefills)
      tickets.forEach(function(t){
        if (!t.onSaleAt) t.onSaleAt = defaultOnSale();
        if (!t.offSaleAt) t.offSaleAt = defaultOffSale();
        if (t.available === "" && defaultAllocation !== "") t.available = String(defaultAllocation);
        ensureTicketBookingFee(t);
      });

      // Drawer state
      var drawerMode = null; // "ticket" | "capacity"
      var activeIdx = -1;

      function openDrawer(mode, idx) {
        drawerMode = mode;
        activeIdx = (typeof idx === "number") ? idx : -1;
        drawer.setAttribute("data-open", "true");
        drawer.setAttribute("aria-hidden", "false");
        renderDrawer();
      }

      function closeDrawer() {
        drawer.setAttribute("data-open", "false");
        drawer.setAttribute("aria-hidden", "true");
        drawerMode = null;
        activeIdx = -1;
        if (drawerBody) drawerBody.innerHTML = "";
      }

      function renderDrawer() {
        if (!drawerBody) return;

        if (drawerMode === "capacity") {
          drawerTitle.textContent = "Event capacity";
          var total = calcTotalAllocations();
              var summary = "Total allocations: " + total;


         drawerBody.innerHTML = \`
  <div>
    <div class="field-label">Event capacity (total tickets to sell overall)</div>
    <input class="input" id="cap_value" type="number" min="0" step="1" value="\${capacityCap || ""}" placeholder="e.g. 200" />
    <div style="margin-top:8px;" class="fee-meta" id="cap_summary">\${summary}</div>
    <div style="margin-top:10px;" class="fee-meta">
      Ticket allocations can be higher than the event capacity — the overall capacity is the hard stop for total tickets sold.
      Leave blank to return to auto capacity (sum of allocations).
    </div>
  </div>
\`;

          return;
        }

        // ticket editor
        if (activeIdx < 0 || !tickets[activeIdx]) return;

        var t = tickets[activeIdx];
        drawerTitle.textContent = "Edit ticket";

        var pricePence = poundsToPence(t.price);
        var metaText = bookingFeeMetaText(pricePence);

        drawerBody.innerHTML = \`
          <div>
            <div class="field-label">Name</div>
            <input class="input" id="t_name" value="\${(t.name || "").replace(/"/g,"&quot;")}" placeholder="General Admission" />
          </div>

          <div>
            <div class="field-label">Price (£)</div>
            <input class="input" id="t_price" type="number" min="0" step="0.01" value="\${t.price ?? ""}" placeholder="0.00" />
          </div>

          <div>
            <div class="field-label">Booking fee (£)</div>
            <input class="input" id="t_fee" type="number" min="0" step="0.01" value="\${t.bookingFee ?? ""}" placeholder="0.00" />
            <div class="fee-meta" id="fee_meta">\${metaText}</div>
          </div>

          <div>
            <div class="field-label">Allocation (qty)</div>
            <input class="input" id="t_avail" type="number" min="0" step="1" value="\${t.available ?? ""}" placeholder="e.g. 200" />
          </div>

          <div>
            <div class="field-label">Sales start (defaults to now)</div>
            <input class="input" id="t_on" type="datetime-local" value="\${t.onSaleAt || ""}" />
          </div>

          <div>
            <div class="field-label">Sales end (defaults to 1 hour before show)</div>
            <input class="input" id="t_off" type="datetime-local" value="\${t.offSaleAt || ""}" />
          </div>
        \`;

        // wire inputs
        var nameEl = document.getElementById("t_name");
        var priceEl = document.getElementById("t_price");
        var feeEl = document.getElementById("t_fee");
        var availEl = document.getElementById("t_avail");
        var onEl = document.getElementById("t_on");
        var offEl = document.getElementById("t_off");
        var metaEl = document.getElementById("fee_meta");

        function syncFeeMeta(){
          ensureTicketBookingFee(tickets[activeIdx]);
          var p = poundsToPence(tickets[activeIdx].price);
          if (metaEl) metaEl.textContent = bookingFeeMetaText(p);
          if (feeEl) feeEl.value = String(tickets[activeIdx].bookingFee ?? "");
        }

        if (nameEl) nameEl.addEventListener("input", function(){ tickets[activeIdx].name = nameEl.value; renderList(); });
        if (priceEl) priceEl.addEventListener("input", function(){ tickets[activeIdx].price = priceEl.value; syncFeeMeta(); renderList(); });
        if (feeEl) feeEl.addEventListener("input", function(){ tickets[activeIdx].bookingFee = feeEl.value; syncFeeMeta(); });
        if (availEl) availEl.addEventListener("input", function(){ tickets[activeIdx].available = availEl.value; renderList(); });
        if (onEl) onEl.addEventListener("input", function(){ tickets[activeIdx].onSaleAt = onEl.value; renderList(); });
        if (offEl) offEl.addEventListener("input", function(){ tickets[activeIdx].offSaleAt = offEl.value; renderList(); });
      }

      function closeAllMenus() {
        var menus = document.querySelectorAll("[data-menu]");
        menus.forEach(function(m){ m.remove(); });
      }

      function renderList() {
        if (!listEl) return;

var totalNow = calcTotalAllocations();

// Auto-update capacity until the user overrides it.
// Default behaviour: capacity = sum of allocations
if (capacityAuto) {
  capacityCap = String(totalNow);
}

var capLabel = (capacityCap !== "" && capacityCap != null)
  ? String(capacityCap)
  : "—";

if (capLabelEl) capLabelEl.textContent = capLabel;

        if (!tickets.length) {
          listEl.innerHTML = '<div class="empty">No tickets yet. Click “Add ticket”.</div>';
          return;
        }

        listEl.innerHTML = "";
        tickets.forEach(function(t, idx){
          var row = document.createElement("div");
          row.className = "ticket-row";

          var name = (t.name && String(t.name).trim()) ? String(t.name).trim() : "Untitled ticket";
          var price = fmtMoney(t.price);
          var alloc = (t.available === "" || t.available == null) ? "0 allocated" : (String(t.available) + " allocated");
          var onTxt = "On sale: " + fmtDT(t.onSaleAt);
          var offTxt = "Off sale: " + fmtDT(t.offSaleAt);

          row.innerHTML = \`
            <div class="ticket-left">
              <div class="ticket-name">\${name}</div>
              <div class="ticket-meta">\${alloc} · \${onTxt} · \${offTxt}</div>
            </div>
            <div class="ticket-right" style="position:relative;">
              <div class="ticket-price">\${price}</div>
              <button class="kebab" type="button" data-kebab="\${idx}">⋯</button>
            </div>
          \`;

          // row click edits (but not when clicking kebab)
          row.addEventListener("click", function(e){
            var target = e.target;
            if (target && target.getAttribute && target.getAttribute("data-kebab") != null) return;
            openDrawer("ticket", idx);
          });

          var kebab = row.querySelector("[data-kebab]");
          if (kebab) {
            kebab.addEventListener("click", function(e){
              e.preventDefault();
              e.stopPropagation();
              closeAllMenus();

              var menu = document.createElement("div");
              menu.className = "menu";
              menu.setAttribute("data-menu", "true");
              menu.innerHTML = \`
                <button type="button" data-act="edit">Edit</button>
                <button type="button" data-act="dup">Duplicate</button>
                <button type="button" class="danger" data-act="del">Delete</button>
              \`;

              menu.addEventListener("click", function(ev){
                var btn = ev.target;
                var act = btn && btn.getAttribute ? btn.getAttribute("data-act") : null;
                if (!act) return;

                if (act === "edit") openDrawer("ticket", idx);

                if (act === "dup") {
                  var copy = Object.assign({}, tickets[idx]);
                  copy.id = "";
                  copy.name = (copy.name ? ("Copy of " + copy.name) : "Copy of ticket");
                  tickets.splice(idx + 1, 0, copy);
                  renderList();
                }

                if (act === "del") {
                  removeTicket(idx);
                }

                closeAllMenus();
              });

              kebab.parentElement.appendChild(menu);
            });
          }

          listEl.appendChild(row);
        });

        // capacity summary line in status (non-error)
        var total = calcTotalAllocations();
        if (capacityCap && Number(capacityCap) > 0) {
          var cap = Number(capacityCap);
          var msg = (total == null)
            ? ("Capacity cap: " + cap + " (set allocations for all tickets to enforce)")
            : ("Capacity cap: " + cap + " · Total allocations: " + total);
          showStatus(msg, "");
        }
      }

      function removeTicket(idx) {
        var t = tickets[idx];
        tickets.splice(idx, 1);
        renderList();

        if (t && t.id) {
          fetch("/admin/ticket-types/" + t.id, { method: "DELETE", credentials: "include" }).catch(function(){});
        }
      }

      function toPayload(t) {
        const pricePence = poundsToPence(t.price);
        const feePence = clampBookingFeePenceClient(pricePence, poundsToPence(t.bookingFee));

        return {
          id: t.id || undefined,
          name: String(t.name || "").trim(),
          pricePence,
          bookingFeePence: pricePence <= 0 ? 0 : feePence,
          available: (t.available === "" || t.available == null) ? null : Number(t.available),
          onSaleAt: t.onSaleAt ? new Date(t.onSaleAt).toISOString() : null,
          offSaleAt: t.offSaleAt ? new Date(t.offSaleAt).toISOString() : null,
        };
      }

      async function saveTickets() {
       // Capacity validation only (we ALLOW cap < total allocations).
// The cap is the total tickets you want to sell overall.
if (capacityCap !== "" && capacityCap != null) {
  var capNum = Number(capacityCap);
  if (!Number.isFinite(capNum) || capNum < 0) {
    showStatus("Capacity must be a positive number (or leave blank).", "error");
    return false;
  }
}

        showStatus("Saving tickets…");
        try {
          for (var i = 0; i < tickets.length; i++) {
            var t = tickets[i];
            var payload = toPayload(t);

                       if (!payload.name) {
              showStatus("Ticket name is required for all tickets.", "error");
              return false;
            }

            // Allocation is REQUIRED (no unlimited / blank allowed)
            if (t.available === "" || t.available == null) {
              showStatus("Allocation is required for every ticket (cannot be blank).", "error");
              return false;
            }
            var allocNum = Number(t.available);
            if (!Number.isFinite(allocNum) || allocNum < 0) {
              showStatus("Allocation must be a valid number (0 or more).", "error");
              return false;
            }

            if (t.id) {
              await jsonRequest("/admin/ticket-types/" + t.id, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
            } else {
              var data = await jsonRequest("/admin/shows/" + showId + "/ticket-types", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (data && data.ticketType && data.ticketType.id) {
                tickets[i].id = data.ticketType.id;
              }
            }
          }

          showStatus("Tickets saved.", "success");
          renderList();
          return true;
        } catch (err) {
          showStatus(err && err.message ? err.message : "Failed to save tickets", "error");
          console.error(err);
          return false;
        }
      }

      async function publishShow() {
        try {
          var ok = await saveTickets();
          if (!ok) return;

          showStatus("Publishing…");
          await jsonRequest("/admin/shows/" + showId, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "LIVE" }),
          });

          showStatus("Show published with unallocated tickets.", "success");
        } catch (err) {
          showStatus(err && err.message ? err.message : "Publish failed", "error");
          console.error(err);
        }
      }

      // Buttons
      var addBtn = document.getElementById("add-ticket");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          tickets.push({
            id: "",
            name: "",
            price: "",
            bookingFee: "",
            onSaleAt: defaultOnSale(),
            offSaleAt: defaultOffSale(),
            available: defaultAllocation !== "" ? String(defaultAllocation) : "",
          });
          renderList();
          openDrawer("ticket", tickets.length - 1);
        });
      }

      var capBtn = document.getElementById("edit-capacity");
      if (capBtn) capBtn.addEventListener("click", function(){ openDrawer("capacity"); });

      var saveBtn = document.getElementById("save-tickets");
      if (saveBtn) saveBtn.addEventListener("click", function(){ saveTickets(); });

      var publishBtn = document.getElementById("publish");
      if (publishBtn) publishBtn.addEventListener("click", function(){ publishShow(); });

      // Drawer close handlers
      function doneHandler(){
      if (drawerMode === "capacity") {
  var capEl = document.getElementById("cap_value");
  var v = capEl ? String(capEl.value || "") : "";

  if (v === "") {
    // Clearing capacity:
    // - if venue capacity exists, revert to it
    // - otherwise return to auto (sum of allocations)
    capacityCap = (showMeta && showMeta.venue && showMeta.venue.capacity) || "";
    capacityAuto = !(capacityCap !== "" && capacityCap != null);
  } else {
    capacityCap = v;
    capacityAuto = false; // user override
  }

  renderList();
}
        closeDrawer();
      }

      if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeDrawer);
      if (drawerClose) drawerClose.addEventListener("click", closeDrawer);
      if (drawerCancel) drawerCancel.addEventListener("click", closeDrawer);
      if (drawerDone) drawerDone.addEventListener("click", doneHandler);

      // close menus on outside click
      document.addEventListener("click", function(){ closeAllMenus(); });

      renderList();

      // Prefill message
      if (prefillInfo && prefillInfo.used) {
        var label = prefillInfo.basedOn ? (" (" + prefillInfo.basedOn + ")") : "";
        showStatus(
          "We've prefilled your most common ticket types/prices from the last 6 months" + label +
          " — please review and click “Save tickets”.",
          "success"
        );
      }
    })();
  </script>
`;


       const html = renderShell({
      title: "Create unallocated tickets",
      body,
      stepLabel: "Step 2 of 2 · Unallocated tickets",
      showId,
      pageClass: "unallocated-page",
      hideHeaderText: true,
    });

    res.status(200).send(html);
  } catch (e) {
    console.error("Error rendering unallocated page", e);
    res.status(500).send("Failed to load unallocated ticket setup");
  }
});

/**
 * STEP 3 — Builder preview lives in admin-seating-builder.ts
 * Route there: GET /admin/seating/builder/preview/:showId
 */

export default router;
