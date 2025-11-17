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
 *   config: {
 *      // wizard values (numTables, rowsPerSection, etc)
 *      wizard?: { ... },
 *      // full Konva layout (sections, tables with seats, objects, tiers, holds)
 *      canvas?: { ... }
 *   },
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
 * Full-page Konva builder (Step 3 of 4)
 * Route: GET /admin/seating/builder/preview/:showId?layout=tables|sections|mixed|blank
 *
 * This now renders a clean shell and boots the Konva-based builder
 * from /static/seating-builder.js (File 2).
 */
router.get("/builder/preview/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const layout = normaliseLayout(req.query.layout as string | undefined);

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
      return res.status(404).send("Show not found");
    }

    const activeSeatMap = show.seatMaps.length > 0 ? show.seatMaps[0] : null;

    const layoutLabelMap: Record<LayoutKey, string> = {
      tables: "Tables & chairs",
      sections: "Sections & rows",
      mixed: "Mixed seating",
      blank: "Blank canvas",
    };

    const layoutLabel = layoutLabelMap[layout];

    // Bootstrap data that File 2 (seating-builder.js) will pick up.
    const bootstrap = {
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
      layoutType: layout,
      layoutLabel,
      apiBase: "/admin/seating/builder/api",
      // Use the full layout JSON if it exists – the front-end knows how to read
      // sections, tables-with-seats, objects, tiers, holds, etc.
      activeSeatMap: activeSeatMap
        ? {
            id: activeSeatMap.id,
            name: activeSeatMap.name,
            version: activeSeatMap.version,
            isTemplate: activeSeatMap.isTemplate,
            isDefault: (activeSeatMap as any).isDefault ?? false,
            layout: (activeSeatMap as any).layout ?? null,
          }
        : null,
    };

    const bootstrapJson = JSON.stringify(bootstrap).replace(
      /</g,
      "\\u003c"
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Seat map builder – TickIn</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
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
      --sidebar-width: 280px;
      --toolbar-height: 52px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
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
      gap: 14px;
      border-radius: 28px;
      background: linear-gradient(145deg, #f9f9ff, #f2f5ff);
      box-shadow: var(--shadow-soft);
      min-height: calc(100vh - 36px);
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
      flex: 1;
      min-height: 540px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--sidebar-width);
      gap: 14px;
    }

    .canvas-panel {
      border-radius: var(--radius-lg);
      background: rgba(255, 255, 255, 0.96);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .canvas-toolbar {
      height: var(--toolbar-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px 6px;
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(248, 250, 252, 0.96);
    }

    .canvas-tabs {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border-radius: 999px;
      padding: 2px;
      background: rgba(15, 23, 42, 0.04);
    }

    .canvas-tab {
      border-radius: 999px;
      border: 0;
      padding: 5px 10px;
      font-size: 12px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }

    .canvas-tab--active {
      background: #fff;
      color: var(--text-main);
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
    }

    .canvas-toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .mini-pill {
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.16);
    }

    .canvas-container {
      position: relative;
      flex: 1;
      overflow: hidden;
    }

    #seatmap-stage-wrapper {
      width: 100%;
      height: 100%;
    }

    .sidebar-panel {
      border-radius: var(--radius-lg);
      background: rgba(255, 255, 255, 0.96);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 10px 14px 8px;
      border-bottom: 1px solid var(--border-subtle);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--text-muted);
    }

    .sidebar-body {
      flex: 1;
      padding: 10px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }

    .tool-row {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
    }

    .tool-button {
      flex: 1;
      border-radius: 12px;
      border: 0;
      padding: 6px 8px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 6px;
      font-size: 12px;
      background: rgba(148, 163, 184, 0.08);
      color: var(--text-main);
      cursor: pointer;
    }

    .tool-button span.icon {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
      font-size: 13px;
    }

    .tool-button small {
      display: block;
      font-size: 10px;
      color: var(--text-muted);
    }

    .sidebar-footer {
      padding: 9px 12px 10px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 6px;
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

    .meta-line {
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
          <span>Seat map</span>
        </div>
        <div class="builder-title">${layoutLabel}</div>
        <div class="builder-subtitle">
          Drag out sections, tables and objects. Then assign tiers and holds – just like Eventbrite.
        </div>
      </div>
      <div class="header-right">
        <div class="header-chip">Show ID: ${show.id}</div>
        ${
          show.venue
            ? `<div class="header-chip">${show.venue.name}${
                show.venue.city ? " – " + show.venue.city : ""
              }</div>`
            : ""
        }
        <button class="header-close" type="button" onclick="window.history.back()">
          <span>×</span>
        </button>
      </div>
    </header>

    <main class="builder-shell">
      <section class="canvas-panel">
        <div class="canvas-toolbar">
          <div class="canvas-tabs" id="seatmap-main-tabs">
            <button class="canvas-tab canvas-tab--active" data-tab="map">Map</button>
            <button class="canvas-tab" data-tab="tiers">Tiers</button>
            <button class="canvas-tab" data-tab="holds">Holds</button>
          </div>
          <div class="canvas-toolbar-right">
            <span class="mini-pill" id="seat-count-pill">0 seats</span>
            <span class="mini-pill" id="selection-pill">No selection</span>
          </div>
        </div>
        <div class="canvas-container">
          <div id="seatmap-stage-wrapper"></div>
        </div>
      </section>

      <aside class="sidebar-panel">
        <div class="sidebar-header">
          <span id="sidebar-mode-label">Capacity tools</span>
        </div>
        <div class="sidebar-body" id="sidebar-body">
          <!-- File 2 (seating-builder.js) will completely control this content,
               switching between:
               - Capacity (Section/Table/Object/Text)
               - Tiers assignment
               - Holds assignment
          -->
          <div class="tool-row">
            <button class="tool-button" data-tool="section">
              <span class="icon">▦</span>
              <span>
                Section
                <small>Row & column blocks</small>
              </span>
            </button>
            <button class="tool-button" data-tool="table">
              <span class="icon">◎</span>
              <span>
                Table
                <small>Circular & rectangular</small>
              </span>
            </button>
          </div>
          <div class="tool-row">
            <button class="tool-button" data-tool="object">
              <span class="icon">⬛</span>
              <span>
                Object
                <small>Stage, bar, doors</small>
              </span>
            </button>
            <button class="tool-button" data-tool="text">
              <span class="icon">A</span>
              <span>
                Text
                <small>Labels & notes</small>
              </span>
            </button>
          </div>
          <p class="meta-line">
            Use the tools above to draw your room. Drag to move, drag corners to resize,
            SHIFT+drag to multi-select – Eventbrite style.
          </p>
        </div>
        <div class="sidebar-footer">
          <button class="primary-btn" type="button" id="btn-save-seatmap">
            💾 Save layout
          </button>
          <button class="secondary-btn" type="button" id="btn-continue-pricing">
            Continue to ticket mapping
          </button>
          <button class="ghost-btn" type="button" onclick="window.history.back()">
            ← Back to seating style
          </button>
        </div>
      </aside>
    </main>
  </div>

  <script>
    window.__TICKIN_SEATMAP_BOOTSTRAP__ = ${bootstrapJson};
  </script>
  <!-- Konva from CDN -->
  <script src="https://unpkg.com/konva@9/konva.min.js"></script>
  <!-- Your Konva-based builder logic (File 2) -->
  <script src="/static/seating-builder.js"></script>
</body>
</html>`;

    res.status(200).send(html);
  } catch (err) {
    console.error("Error in GET /builder/preview/:showId", err);
    res.status(500).send("Internal error");
  }
});

export default router;
