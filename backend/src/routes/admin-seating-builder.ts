// backend/src/routes/admin-seating-builder.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../utils/security.js";

const prisma = new PrismaClient();
const router = Router();

type LayoutKey = "tables" | "sections" | "mixed" | "blank";

function normaliseLayout(raw: string | undefined): LayoutKey {
  if (raw === "tables" || raw === "sections" || raw === "mixed" || raw === "blank") {
    return raw;
  }
  return "tables";
}

/**
 * Helper: get current user id from the auth cookie (JWT).
 */
async function getUserIdFromRequest(req: any): Promise<string | null> {
  try {
    const token = (req.cookies && req.cookies.auth) || null;
    if (!token) return null;
    const payload = await verifyJwt<{ sub?: string }>(token);
    if (!payload || !payload.sub) return null;
    return String(payload.sub);
  } catch {
    return null;
  }
}

/**
 * API: Fetch builder data for a show
 * GET /admin/seating/builder/api/seatmaps/:showId
 *
 * Returns:
 * - basic show & venue info
 * - any seat maps already attached to this show
 * - any seat maps/templates for this venue created by this user
 */
router.get("/builder/api/seatmaps/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const userId = await getUserIdFromRequest(req);

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: true,
        seatMaps: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!show) {
      return res.status(404).json({ error: "Show not found" });
    }

    const venueId = show.venueId ?? undefined;

    let previousMaps: any[] = [];
    let templates: any[] = [];

    if (venueId) {
      const whereBase: any = {
        venueId,
      };

      const wherePrevious: any = {
        ...whereBase,
        isTemplate: false,
      };

      const whereTemplates: any = {
        ...whereBase,
        isTemplate: true,
      };

      // Filter by user if we have a userId
      if (userId) {
        wherePrevious.createdByUserId = userId;
        whereTemplates.createdByUserId = userId;
      }

      previousMaps = await prisma.seatMap.findMany({
        where: wherePrevious,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          version: true,
          layout: true,
          isTemplate: true,
          isDefault: true,
        },
      });

      templates = await prisma.seatMap.findMany({
        where: whereTemplates,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          version: true,
          layout: true,
          isTemplate: true,
          isDefault: true,
        },
      });
    }

    const activeSeatMap = show.seatMaps.length > 0 ? show.seatMaps[0] : null;

    return res.json({
      show: {
        id: show.id,
        title: show.title,
        date: show.date,
        venue: show.venue
          ? {
            id: show.venue.id,
            name: show.venue.name,
            city: show.venue.city,
            capacity: show.venue.capacity,
          }
          : null,
      },
      activeSeatMap: activeSeatMap
        ? {
          id: activeSeatMap.id,
          name: activeSeatMap.name,
          layout: activeSeatMap.layout,
          isTemplate: activeSeatMap.isTemplate,
          isDefault: activeSeatMap.isDefault,
          version: activeSeatMap.version,
        }
        : null,
      previousMaps,
      templates,
    });
  } catch (err) {
    console.error("Error in GET /builder/api/seatmaps/:showId", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * API: Save / update a seat map for this show
 * POST /admin/seating/builder/api/seatmaps/:showId
 *
 * Body JSON:
 * {
 *   layoutType: "tables" | "sections" | "mixed" | "blank",
 *   config: { ...numbers from overlay... },
 *   estimatedCapacity: number,
 *   name?: string,
 *   saveAsTemplate?: boolean,
 *   seatMapId?: string  // if provided, we update instead of create
 * }
 */
router.post("/builder/api/seatmaps/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const {
      layoutType,
      config,
      estimatedCapacity,
      name,
      saveAsTemplate,
      seatMapId,
    } = req.body ?? {};

    if (!layoutType) {
      return res.status(400).json({ error: "layoutType is required" });
    }

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { venue: true },
    });

    if (!show) {
      return res.status(404).json({ error: "Show not found" });
    }

    const userId = await getUserIdFromRequest(req);

    const finalName =
      name ||
      `${show.venue?.name ?? "Room"} – ${layoutType
        .charAt(0)
        .toUpperCase()}${layoutType.slice(1)} layout`;

    const layoutPayload = {
      layoutType,
      config: config || {},
      estimatedCapacity: estimatedCapacity ?? null,
      meta: {
        showId,
        venueId: show.venueId ?? null,
        savedAt: new Date().toISOString(),
      },
    };

    let saved;

    if (seatMapId) {
      saved = await prisma.seatMap.update({
        where: { id: seatMapId },
        data: {
          name: finalName,
          layout: layoutPayload as any,
          isTemplate: !!saveAsTemplate,
          updatedAt: new Date(),
          // bump version for updates
          version: { increment: 1 },
        },
      });
    } else {
      saved = await prisma.seatMap.create({
        data: {
          name: finalName,
          layout: layoutPayload as any,
          isTemplate: !!saveAsTemplate,
          createdByUserId: userId ?? null,
          showId: show.id,
          venueId: show.venueId ?? null,
        },
      });
    }

    return res.json({
      ok: true,
      seatMap: {
        id: saved.id,
        name: saved.name,
        version: saved.version,
        isTemplate: saved.isTemplate,
      },
    });
  } catch (err) {
    console.error("Error in POST /builder/api/seatmaps/:showId", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * Full-page builder (Step 3 of 4)
 * Route: GET /admin/seating/builder/preview/:showId
 */
router.get("/builder/preview/:showId", (req, res) => {
  const showId = req.params.showId;
  const layout = normaliseLayout(req.query.layout as string | undefined);

  const layoutLabelMap: Record<LayoutKey, string> = {
    tables: "Tables & chairs",
    sections: "Sections & rows",
    mixed: "Mixed seating",
    blank: "Blank canvas",
  };

  const layoutLabel = layoutLabelMap[layout];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Seat map builder – TickIn</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      --bg: #f3f5fb;
      --card-bg: #ffffff;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.12);
      --accent-strong: rgba(37, 99, 235, 0.18);
      --border-subtle: rgba(15, 23, 42, 0.06);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --pill-bg: #e2e8f0;
      --pill-text: #475569;
      --radius-lg: 22px;
      --radius-xl: 26px;
      --shadow-soft: 0 18px 45px rgba(15, 23, 42, 0.12);
      --shadow-card: 0 12px 30px rgba(15, 23, 42, 0.08);
      --error: #b91c1c;
      --success: #16a34a;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", sans-serif;
      color: var(--text-main);
      background: radial-gradient(circle at top left, #e0ecff, #f6f7fc 44%, #eef1ff 85%);
    }

    body {
      display: flex;
      align-items: stretch;
      justify-content: center;
    }

    .builder-root {
      width: 100%;
      max-width: 1440px;
      margin: 18px auto;
      padding: 16px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-radius: 28px;
      background: linear-gradient(145deg, #f9f9ff, #f2f5ff);
      box-shadow: var(--shadow-soft);
    }

    .builder-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
    }

    .step-pill span.step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      font-weight: 600;
      font-size: 10px;
    }

    .builder-title {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .builder-subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-chip {
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.15);
      color: #475569;
    }

    .header-close {
      border-radius: 999px;
      border: 0;
      background: white;
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.1);
      cursor: pointer;
    }

    .header-close span {
      font-size: 17px;
      line-height: 1;
    }

    .header-close:hover {
      transform: translateY(-1px);
    }

    .builder-shell {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr) 260px;
      gap: 16px;
      height: calc(100vh - 120px);
      min-height: 520px;
    }

    .panel {
      border-radius: var(--radius-lg);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: var(--shadow-card);
      padding: 16px 16px 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .tool-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    .tool-button {
      border-radius: 999px;
      border: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 10px;
      font-size: 12px;
      background: rgba(148, 163, 184, 0.06);
      color: var(--text-main);
      cursor: pointer;
      transition: background 120ms ease-out, transform 120ms ease-out;
    }

    .tool-button:hover {
      background: rgba(148, 163, 184, 0.12);
      transform: translateY(-1px);
    }

    .tool-main {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .tool-emoji {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
      font-size: 14px;
    }

    .tool-label {
      font-weight: 500;
      letter-spacing: -0.01em;
    }

    .tool-meta {
      font-size: 10px;
      color: var(--text-muted);
    }

    .tool-badge {
      font-size: 10px;
      padding: 3px 7px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.06);
      color: var(--accent);
    }

    .canvas-inner {
      position: relative;
      flex: 1;
      border-radius: 18px;
      background-image: linear-gradient(
          to right,
          rgba(148, 163, 184, 0.16) 1px,
          transparent 1px
        ),
        linear-gradient(
          to bottom,
          rgba(148, 163, 184, 0.16) 1px,
          transparent 1px
        );
      background-size: 32px 32px;
      background-position: center;
      overflow: hidden;
    }

    .canvas-overlay-label {
      position: absolute;
      top: 10px;
      left: 12px;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      color: white;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .canvas-overlay-label span.dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #22c55e;
    }

    .canvas-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .canvas-placeholder-inner {
      padding: 14px 18px;
      border-radius: 18px;
      background: rgba(248, 250, 252, 0.96);
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
      text-align: left;
      max-width: 360px;
    }

    .canvas-placeholder-inner h2 {
      font-size: 15px;
      margin: 0 0 4px;
    }

    .canvas-placeholder-inner p {
      font-size: 12px;
      margin: 0 0 10px;
      color: var(--text-muted);
    }

    .canvas-placeholder-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .canvas-placeholder-pill {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(148, 163, 184, 0.16);
      color: #475569;
    }

    .layout-preview {
      position: absolute;
      inset: 54px 28px 24px 28px;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 16px;
      overflow: auto;
      padding: 4px;
    }

    .layout-group-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .table-group,
    .row-group,
    .mixed-group {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.03);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.10);
    }

    .seats-row {
      display: flex;
      gap: 4px;
    }

    .seat-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: white;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.25);
    }

    .seat-dot--primary {
      background: var(--accent);
    }

    .summary-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }

    .summary-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 10px;
      background: rgba(148, 163, 184, 0.07);
    }

    .summary-row span.label {
      color: var(--text-muted);
    }

    .summary-row span.value {
      font-weight: 500;
    }

    .summary-note {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .summary-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .primary-btn {
      border-radius: 999px;
      border: 0;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 500;
      background: var(--accent);
      color: white;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 10px 24px var(--accent-strong);
    }

    .secondary-btn {
      border-radius: 999px;
      border: 0;
      padding: 8px 13px;
      font-size: 12px;
      font-weight: 500;
      background: rgba(37, 99, 235, 0.06);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }

    .ghost-btn {
      border-radius: 999px;
      border: 0;
      padding: 8px 12px;
      font-size: 12px;
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }

    .config-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.30), rgba(15, 23, 42, 0.58));
      z-index: 10;
    }

    .config-card {
      width: 480px;
      max-width: 92vw;
      border-radius: var(--radius-xl);
      background: rgba(248, 250, 252, 0.98);
      box-shadow: 0 26px 60px rgba(15, 23, 42, 0.4);
      padding: 18px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .config-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .config-title-block {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .config-caption {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(148, 163, 184, 1);
    }

    .config-heading {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .config-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      max-width: 280px;
    }

    .config-chip {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(148, 163, 184, 0.14);
      color: #475569;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 14px;
      margin-top: 4px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .field-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }

    .field-label {
      font-weight: 500;
    }

    .field-hint {
      font-size: 10px;
      color: var(--text-muted);
    }

    .field input[type="number"] {
      border-radius: 11px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      padding: 7px 9px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
    }

    .field input[type="number"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent-soft);
    }

    .config-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 6px;
    }

    .config-total {
      font-size: 12px;
      color: var(--text-muted);
    }

    .config-total strong {
      color: var(--text-main);
    }

    .config-actions {
      display: flex;
      gap: 8px;
    }

    .hidden {
      display: none !important;
    }

    .toast {
      position: fixed;
      bottom: 18px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 12px;
      background: #0f172a;
      color: #e5e7eb;
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.4);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      z-index: 40;
    }

    .toast--success {
      background: #16a34a;
    }

    .toast--error {
      background: #b91c1c;
    }

    .toast-icon {
      font-size: 14px;
    }

    .toast-close {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 0;
      margin-left: 6px;
      font-size: 14px;
    }

    .map-meta {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .map-meta strong {
      color: var(--text-main);
    }

    .name-input {
      margin-top: 8px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .name-input input {
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      padding: 6px 10px;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
    }

    .name-input input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent-soft);
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      font-size: 11px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="builder-root">
    <header class="builder-header">
      <div class="header-left">
        <div class="step-pill">
          <span class="step-number">3</span>
          <span>Layout details</span>
        </div>
        <div class="builder-title">${layoutLabel}</div>
        <div class="builder-subtitle">
          Configure the room once and reuse this layout for future shows at this venue.
        </div>
      </div>
      <div class="header-right">
        <div class="header-chip">Show ID: ${showId}</div>
        <button class="header-close" type="button" onclick="window.history.back()">
          <span>×</span>
        </button>
      </div>
    </header>

    <main class="builder-shell">
      <aside class="panel">
        <div class="panel-title">Tools</div>
        <div class="tool-list">
          <button class="tool-button" type="button" id="tool-stage">
            <div class="tool-main">
              <div class="tool-emoji">🎭</div>
              <div>
                <div class="tool-label">Stage & focal point</div>
                <div class="tool-meta">Front of room, entrances, bars</div>
              </div>
            </div>
            <span class="tool-badge">Helper</span>
          </button>
          <button class="tool-button" type="button" id="tool-seats">
            <div class="tool-main">
              <div class="tool-emoji">🪑</div>
              <div>
                <div class="tool-label">Seat blocks</div>
                <div class="tool-meta">Rows, tables, zones</div>
              </div>
            </div>
            <span class="tool-badge">Wizard</span>
          </button>
          <button class="tool-button" type="button" id="tool-tiers">
            <div class="tool-main">
              <div class="tool-emoji">🎟️</div>
              <div>
                <div class="tool-label">Ticket tiers</div>
                <div class="tool-meta">Link seats to prices</div>
              </div>
            </div>
            <span class="tool-badge">Next</span>
          </button>
        </div>
      </aside>

      <section class="panel">
        <div class="panel-title">Room preview</div>
        <div class="canvas-inner" id="canvas-inner">
          <div class="canvas-overlay-label">
            <span class="dot"></span>
            Live layout preview
          </div>
          <div class="canvas-placeholder" id="canvas-placeholder">
            <div class="canvas-placeholder-inner">
              <h2>Your layout will appear here</h2>
              <p id="preview-summary">
                Adjust the numbers on the right and we'll sketch a layout preview before you save.
              </p>
              <div class="canvas-placeholder-pills">
                <span class="canvas-placeholder-pill">Drag &amp; drop editor coming next</span>
                <span class="canvas-placeholder-pill">Re-use layouts across shows</span>
                <span class="canvas-placeholder-pill">Perfect for comedy, music &amp; cabaret</span>
              </div>
            </div>
          </div>
          <div class="layout-preview" id="layout-preview"></div>
        </div>
      </section>

      <aside class="panel">
        <div class="panel-title">Summary</div>
        <div class="summary-body">
          <div class="summary-row">
            <span class="label">Layout type</span>
            <span class="value" id="summary-layout">${layoutLabel}</span>
          </div>
          <div class="summary-row">
            <span class="label">Estimated capacity</span>
            <span class="value" id="summary-capacity">–</span>
          </div>
          <div class="summary-row">
            <span class="label">Stage & facilities</span>
            <span class="value">Stage + bar + exits</span>
          </div>
          <div class="summary-note">
            This step is just to sketch the room. You'll assign ticket prices to specific seats in the next step.
          </div>
          <div class="name-input">
            <label for="seatmap-name">Layout name (optional)</label>
            <input id="seatmap-name" type="text" placeholder="e.g. Main room cabaret – 180 seats" />
          </div>
          <label class="checkbox-row">
            <input type="checkbox" id="seatmap-template" />
            <span>Save this layout as a template for this venue</span>
          </label>
          <div class="map-meta" id="map-meta"></div>
        </div>
        <div class="summary-footer">
          <button class="primary-btn" type="button" id="btn-save">
            💾 Save layout
          </button>
          <button class="secondary-btn" type="button" id="btn-next">
            Continue to ticket mapping
          </button>
          <button class="ghost-btn" type="button" id="btn-back">
            ← Back to seating style
          </button>
        </div>
      </aside>
    </main>
  </div>

  <!-- Configuration overlay (Step 3 inputs) -->
  <div class="config-overlay" id="config-overlay">
    <div class="config-card">
      <div class="config-header">
        <div class="config-title-block">
          <div class="config-caption">Step 3 of 4</div>
          <div class="config-heading">Tell us about this room</div>
          <div class="config-subtitle" id="config-subtitle">
            We'll use these numbers to sketch the first version of your layout. You can fine-tune it in the editor.
          </div>
        </div>
        <div class="config-chip" id="config-chip">${layoutLabel}</div>
      </div>

      <div class="config-grid" id="config-grid">
        <!-- Fields injected by script -->
      </div>

      <div class="config-footer">
        <div class="config-total">
          Estimated seats: <strong id="config-total-value">–</strong>
        </div>
        <div class="config-actions">
          <button class="ghost-btn" type="button" id="config-cancel">
            Cancel
          </button>
          <button class="primary-btn" type="button" id="config-continue">
            Continue
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      const layout = ${JSON.stringify(layout)};
      const showId = ${JSON.stringify(showId)};

      const overlay = document.getElementById("config-overlay");
      const grid = document.getElementById("config-grid");
      const totalSpan = document.getElementById("config-total-value");
      const summaryCapacity = document.getElementById("summary-capacity");
      const previewContainer = document.getElementById("layout-preview");
      const previewSummary = document.getElementById("preview-summary");
      const summaryLayout = document.getElementById("summary-layout");
      const chip = document.getElementById("config-chip");
      const subtitle = document.getElementById("config-subtitle");
      const mapMeta = document.getElementById("map-meta");
      const nameInput = document.getElementById("seatmap-name");
      const templateCheckbox = document.getElementById("seatmap-template");

      const btnContinue = document.getElementById("config-continue");
      const btnCancel = document.getElementById("config-cancel");
      const btnNext = document.getElementById("btn-next");
      const btnBack = document.getElementById("btn-back");
      const btnSave = document.getElementById("btn-save");

      const toolStage = document.getElementById("tool-stage");
      const toolSeats = document.getElementById("tool-seats");
      const toolTiers = document.getElementById("tool-tiers");

      const layoutLabels = {
        tables: "Tables & chairs",
        sections: "Sections & rows",
        mixed: "Mixed seating",
        blank: "Blank canvas",
      };

      const builderState = {
        layoutType: layout,
        config: {},
        estimatedCapacity: 0,
        seatMapId: null,
      };

      summaryLayout.textContent = layoutLabels[layout] || layoutLabels.tables;
      chip.textContent = layoutLabels[layout] || layoutLabels.tables;

      function showToast(message, type) {
        const toast = document.createElement("div");
        toast.className = "toast" + (type === "error" ? " toast--error" : type === "success" ? " toast--success" : "");
        const icon = document.createElement("span");
        icon.className = "toast-icon";
        icon.textContent = type === "error" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
        const text = document.createElement("span");
        text.textContent = message;
        const close = document.createElement("button");
        close.className = "toast-close";
        close.type = "button";
        close.textContent = "×";
        close.addEventListener("click", function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
        toast.appendChild(icon);
        toast.appendChild(text);
        toast.appendChild(close);
        document.body.appendChild(toast);
        setTimeout(function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3500);
      }

      // If layout is blank, we skip the numeric wizard
      if (layout === "blank") {
        if (overlay) overlay.classList.add("hidden");
        if (previewSummary) {
          previewSummary.textContent = "Start from a true blank canvas. Use the editor to place sections, tables and seats exactly where you want them.";
        }
        summaryCapacity.textContent = "Flexible";
        builderState.estimatedCapacity = 0;
      }

      const fieldDefsByLayout = {
        tables: [
          { key: "numTables", label: "Number of tables", hint: "e.g. 12–30", defaultValue: 16, min: 1 },
          { key: "seatsPerTable", label: "Seats per table", hint: "e.g. 8–12", defaultValue: 8, min: 1 }
        ],
        sections: [
          { key: "numSections", label: "Number of sections", hint: "e.g. stalls, circle, balcony", defaultValue: 3, min: 1 },
          { key: "rowsPerSection", label: "Rows per section", hint: "e.g. 8–20", defaultValue: 10, min: 1 },
          { key: "seatsPerRow", label: "Seats per row", hint: "e.g. 10–30", defaultValue: 16, min: 1 }
        ],
        mixed: [
          { key: "numSections", label: "Number of row sections", hint: "e.g. 2–6", defaultValue: 3, min: 1 },
          { key: "rowsPerSection", label: "Rows per section", hint: "e.g. 5–12", defaultValue: 6, min: 1 },
          { key: "seatsPerRow", label: "Seats per row", hint: "e.g. 10–20", defaultValue: 12, min: 1 },
          { key: "numTables", label: "Number of tables", hint: "e.g. 4–20", defaultValue: 8, min: 0 },
          { key: "seatsPerTable", label: "Seats per table", hint: "e.g. 4–10", defaultValue: 6, min: 0 }
        ]
      };

      const fields = fieldDefsByLayout[layout] || fieldDefsByLayout.tables;

      function renderFields() {
        if (!grid) return;
        grid.innerHTML = "";
        fields.forEach(function (f) {
          const wrapper = document.createElement("div");
          wrapper.className = "field";
          const labelRow = document.createElement("div");
          labelRow.className = "field-label-row";
          const label = document.createElement("div");
          label.className = "field-label";
          label.textContent = f.label;
          const hint = document.createElement("div");
          hint.className = "field-hint";
          hint.textContent = f.hint || "";
          labelRow.appendChild(label);
          wrapper.appendChild(labelRow);
          wrapper.appendChild(hint);
          const input = document.createElement("input");
          input.type = "number";
          input.min = String(f.min ?? 0);
          input.value = String(f.defaultValue ?? 0);
          input.id = "field-" + f.key;
          input.addEventListener("input", updateTotals);
          wrapper.appendChild(input);
          grid.appendChild(wrapper);
        });
      }

      function getValue(id, fallback) {
        const el = document.getElementById("field-" + id);
        if (!el || !(el instanceof HTMLInputElement)) return fallback;
        const n = parseInt(el.value, 10);
        if (isNaN(n) || n < 0) return fallback;
        return n;
      }

      function updateTotals() {
        let total = 0;
        const cfg = {};

        if (layout === "tables") {
          const t = getValue("numTables", 0);
          const s = getValue("seatsPerTable", 0);
          total = t * s;
          cfg["numTables"] = t;
          cfg["seatsPerTable"] = s;
        } else if (layout === "sections") {
          const sec = getValue("numSections", 0);
          const rows = getValue("rowsPerSection", 0);
          const per = getValue("seatsPerRow", 0);
          total = sec * rows * per;
          cfg["numSections"] = sec;
          cfg["rowsPerSection"] = rows;
          cfg["seatsPerRow"] = per;
        } else if (layout === "mixed") {
          const sec2 = getValue("numSections", 0);
          const rows2 = getValue("rowsPerSection", 0);
          const per2 = getValue("seatsPerRow", 0);
          const t2 = getValue("numTables", 0);
          const s2 = getValue("seatsPerTable", 0);
          total = sec2 * rows2 * per2 + t2 * s2;
          cfg["numSections"] = sec2;
          cfg["rowsPerSection"] = rows2;
          cfg["seatsPerRow"] = per2;
          cfg["numTables"] = t2;
          cfg["seatsPerTable"] = s2;
        }

        builderState.config = cfg;
        builderState.estimatedCapacity = total;

        totalSpan.textContent = total > 0 ? String(total) : "–";
        summaryCapacity.textContent = total > 0 ? String(total) : "TBC";
        drawPreview(total);
      }

      function drawPreview(totalSeats) {
        previewContainer.innerHTML = "";
        if (totalSeats <= 0) return;

        if (layout === "tables" || layout === "mixed") {
          const numTables = builderState.config["numTables"] || 0;
          const seatsPerTable = builderState.config["seatsPerTable"] || 0;
          if (numTables > 0 && seatsPerTable > 0) {
            const group = document.createElement("div");
            group.className = layout === "mixed" ? "mixed-group" : "table-group";
            const label = document.createElement("div");
            label.className = "layout-group-label";
            label.textContent = layout === "mixed" ? "Table zones" : "Cabaret tables";
            group.appendChild(label);

            for (let i = 0; i < Math.min(numTables, 6); i++) {
              const row = document.createElement("div");
              row.className = "seats-row";
              for (let j = 0; j < Math.min(seatsPerTable, 10); j++) {
                const dot = document.createElement("div");
                dot.className = "seat-dot";
                if (j === 0) dot.classList.add("seat-dot--primary");
                row.appendChild(dot);
              }
              group.appendChild(row);
            }
            previewContainer.appendChild(group);
          }
        }

        if (layout === "sections" || layout === "mixed") {
          const numSections = builderState.config["numSections"] || 0;
          const rows = builderState.config["rowsPerSection"] || 0;
          const perRow = builderState.config["seatsPerRow"] || 0;
          if (numSections > 0 && rows > 0 && perRow > 0) {
            const group2 = document.createElement("div");
            group2.className = layout === "mixed" ? "mixed-group" : "row-group";
            const label2 = document.createElement("div");
            label2.className = "layout-group-label";
            label2.textContent = layout === "mixed" ? "Row sections" : "Theatre rows";
            group2.appendChild(label2);

            for (let r = 0; r < Math.min(rows, 6); r++) {
              const row2 = document.createElement("div");
              row2.className = "seats-row";
              for (let c = 0; c < Math.min(perRow, 18); c++) {
                const dot2 = document.createElement("div");
                dot2.className = "seat-dot";
                if (c === 0 && r === 0) dot2.classList.add("seat-dot--primary");
                row2.appendChild(dot2);
              }
              group2.appendChild(row2);
            }
            previewContainer.appendChild(group2);
          }
        }

        if (previewSummary) {
          previewSummary.textContent =
            "This is a visual sketch only. We'll use these numbers to generate the seat map for ticketing.";
        }
      }

      function loadExisting() {
        fetch("/admin/seating/builder/api/seatmaps/" + encodeURIComponent(showId), {
          method: "GET",
          credentials: "include",
        })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (data) {
            if (!data) return;
            if (data.activeSeatMap) {
              builderState.seatMapId = data.activeSeatMap.id;
              mapMeta.textContent = "Editing existing layout: " + (data.activeSeatMap.name || data.show.venue?.name || "Seat map") + " · v" + data.activeSeatMap.version;
              if (data.activeSeatMap.layout && data.activeSeatMap.layout.config) {
                builderState.config = data.activeSeatMap.layout.config;
                builderState.estimatedCapacity = data.activeSeatMap.layout.estimatedCapacity || 0;
                fields.forEach(function (f) {
                  const el = document.getElementById("field-" + f.key);
                  if (el && el instanceof HTMLInputElement) {
                    const val = builderState.config[f.key];
                    if (typeof val === "number") {
                      el.value = String(val);
                    }
                  }
                });
                if (builderState.estimatedCapacity) {
                  totalSpan.textContent = String(builderState.estimatedCapacity);
                  summaryCapacity.textContent = String(builderState.estimatedCapacity);
                  drawPreview(builderState.estimatedCapacity);
                }
              }
            } else {
              mapMeta.textContent = "New layout for this show. Once saved, you'll be able to reuse it as a template.";
            }
          })
          .catch(function () { /* ignore */ });
      }

      function saveLayout() {
        if (layout !== "blank" && builderState.estimatedCapacity <= 0) {
          showToast("Please set the table/row numbers before saving.", "error");
          return;
        }

        const payload = {
          layoutType: layout,
          config: builderState.config,
          estimatedCapacity: builderState.estimatedCapacity,
          name: nameInput && nameInput.value ? nameInput.value.trim() : undefined,
          saveAsTemplate: templateCheckbox && templateCheckbox.checked ? true : false,
          seatMapId: builderState.seatMapId || undefined,
        };

        fetch("/admin/seating/builder/api/seatmaps/" + encodeURIComponent(showId), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!data || data.error) {
              showToast("Could not save layout. Please try again.", "error");
              return;
            }
            builderState.seatMapId = data.seatMap.id;
            mapMeta.textContent = "Saved as: " + data.seatMap.name + " · v" + data.seatMap.version + (data.seatMap.isTemplate ? " · Template" : "");
            showToast("Layout saved successfully.", "success");
          })
          .catch(function () {
            showToast("Could not save layout. Please try again.", "error");
          });
      }

      if (layout === "tables") {
        subtitle.textContent = "Perfect for comedy clubs, cabaret and gala dinners. Set your table counts once, then reuse them.";
      } else if (layout === "sections") {
        subtitle.textContent = "Classic theatre style. We'll sketch sections and rows so you can tweak them in the editor.";
      } else if (layout === "mixed") {
        subtitle.textContent = "Blend reserved rows with cabaret tables – ideal for flexible spaces and premium zones.";
      }

      if (layout !== "blank") {
        renderFields();
        updateTotals();
      }

      btnContinue.addEventListener("click", function () {
        overlay.classList.add("hidden");
      });

      btnCancel.addEventListener("click", function () {
        overlay.classList.add("hidden");
      });

      btnBack.addEventListener("click", function () {
        window.history.back();
      });

      btnNext.addEventListener("click", function () {
        showToast("Ticket mapping step will plug into this layout next.", "info");
      });

      btnSave.addEventListener("click", function () {
        saveLayout();
      });

      toolStage.addEventListener("click", function () {
        showToast("Stage helper will let you mark entrances, exits and focal points in the next version.", "info");
      });

      toolSeats.addEventListener("click", function () {
        overlay.classList.remove("hidden");
      });

      toolTiers.addEventListener("click", function () {
        showToast("Ticket tiers step will let you attach prices to zones and rows.", "info");
      });

      loadExisting();
    })();
  </script>
</body>
</html>`;

  res.status(200).send(html);
});

export default router;
