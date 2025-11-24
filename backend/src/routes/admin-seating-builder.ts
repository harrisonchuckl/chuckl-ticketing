import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../utils/security.js";

const prisma = new PrismaClient();
const router = Router();

/**
 * LayoutKey is still used for analytics + templates
 * but now the saved layout includes full Konva JSON.
 */
type LayoutKey = "tables" | "sections" | "mixed" | "blank";

function normaliseLayout(raw: string | undefined): LayoutKey {
  if (raw === "tables" || raw === "sections" || raw === "mixed" || raw === "blank") {
    return raw;
  }
  return "tables";
}

/**
 * Helper: extract userId from JWT cookie
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

/* -------------------------------------------------------------
   ROUTE: GET available seat maps for this show
-------------------------------------------------------------- */
router.get("/builder/api/seatmaps/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const userId = await getUserIdFromRequest(req);

    const rawShows = await prisma.$queryRaw<
      { id: string; title: string | null; date: Date | null; venueId: string | null }[]
    >`SELECT "id","title","date","venueId" FROM "Show" WHERE "id" = ${showId} LIMIT 1`;

    const showRow = rawShows[0];
    if (!showRow) {
      return res.status(404).json({ error: "Show not found" });
    }

    let venue: any = null;
    if (showRow.venueId) {
      venue = await prisma.venue.findUnique({
        where: { id: showRow.venueId },
        select: {
          id: true,
          name: true,
          city: true,
          capacity: true,
        },
      });
    }

    const seatMapsForShow = await prisma.seatMap.findMany({
      where: { showId },
      orderBy: { createdAt: "desc" },
    });
    const activeSeatMap = seatMapsForShow.length > 0 ? seatMapsForShow[0] : null;

    let previousMaps: any[] = [];
    let templates: any[] = [];

    if (showRow.venueId) {
      const base = { venueId: showRow.venueId };
      const previousWhere: any = { ...base, isTemplate: false };
      const templateWhere: any = { ...base, isTemplate: true };

      if (userId) {
        previousWhere.createdByUserId = userId;
        templateWhere.createdByUserId = userId;
      }

      previousMaps = await prisma.seatMap.findMany({
        where: previousWhere,
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
        where: templateWhere,
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

    return res.json({
      show: {
        id: showRow.id,
        title: showRow.title,
        date: showRow.date,
        venue: venue
          ? {
              id: venue.id,
              name: venue.name,
              city: venue.city,
              capacity: venue.capacity,
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

/* -------------------------------------------------------------
   ROUTE: POST save seat map
-------------------------------------------------------------- */
router.post("/builder/api/seatmaps/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const {
      seatMapId,
      saveAsTemplate,
      name,
      layoutType,
      config,
      estimatedCapacity,
      konvaJson,
    } = req.body ?? {};

    const showRow = (
      await prisma.$queryRaw<{ id: string; venueId: string | null }[]>
        `SELECT "id","venueId" FROM "Show" WHERE "id" = ${showId} LIMIT 1`
    )[0];

    if (!showRow) {
      return res.status(404).json({ error: "Show not found" });
    }

    const userId = await getUserIdFromRequest(req);

    const finalName =
      name ||
      ((showRow.venueId ? "Room layout" : "Room") +
        (layoutType ? ` – ${layoutType}` : " – Layout"));

    const layoutPayload = {
      layoutType: layoutType ?? null,
      config: config ?? null,
      estimatedCapacity: estimatedCapacity ?? null,
      konvaJson: konvaJson ?? null,
      meta: {
        showId,
        venueId: showRow.venueId ?? null,
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
          showId: showRow.id,
          venueId: showRow.venueId ?? null,
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

/* -------------------------------------------------------------
   ROUTE: GET builder full-page HTML
-------------------------------------------------------------- */
router.get("/builder/preview/:showId", (req, res) => {
  const showId = req.params.showId;
  const layout = normaliseLayout(req.query.layout as string | undefined);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TickIn Seat Designer</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="stylesheet" href="/static/seating-builder.css" />

    <!-- Brand + toolbar styling (inline so we can iterate quickly) -->
    <style>
      :root {
        --tixall-blue: #08B8E8;
        --tixall-blue-soft: #E6F9FF;
        --tixall-dark: #182828;
        --tixall-grey-soft: #F4F5F7;
        --tixall-border-subtle: #E2E4EA;
      }

      body.tickin-builder-body {
        background: #f5f7fa;
        color: var(--tixall-dark);
      }

      .tickin-builder-shell {
        background: #ffffff;
      }

      .tickin-builder-topbar {
        border-bottom: 1px solid var(--tixall-border-subtle);
        background: linear-gradient(90deg, #ffffff, #f7fbff);
      }

      .tb-logo-badge {
        background: #071018;
        border-radius: 999px;
        padding: 4px 10px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .tb-logo-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--tixall-blue);
      }

      .tb-logo-text {
        font-weight: 600;
        font-size: 13px;
        color: #ffffff;
      }

      .tb-topbar-btn.tb-btn-primary {
        border-radius: 999px;
        border: 0;
        background: linear-gradient(135deg, var(--tixall-blue), #08c8f8);
        color: #ffffff;
        box-shadow: 0 10px 24px rgba(8, 184, 232, 0.4);
        font-weight: 600;
      }

      .tb-topbar-btn.tb-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 30px rgba(8, 184, 232, 0.45);
      }

      .tb-topbar-btn.tb-btn-ghost {
        border-radius: 999px;
        border: 1px solid var(--tixall-border-subtle);
        background: #ffffff;
        color: var(--tixall-dark);
      }

      /* LEFT RAIL */
      .tb-left-rail {
        background: linear-gradient(180deg, #f7fafc, #f2f5f9);
        border-right: 1px solid var(--tixall-border-subtle);
        /* allow flyouts to escape the rail */
        overflow: visible !important;
      }

      .tb-left-scroll {
        padding: 16px 10px 18px;
        /* allow flyouts to escape the scroll area */
        overflow: visible !important;
      }

      .tb-left-group {
        margin-bottom: 18px;
      }

      .tb-left-group-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7a828f;
        margin: 0 6px 8px;
      }

      /* Base left-rail button styling (Undo / Redo / Clear etc) */
      .tb-left-item {
        border: 0;
        background: transparent;
        border-radius: 999px;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        text-align: left;
        cursor: pointer;
        font-size: 12px;
        color: var(--tixall-dark);
        box-sizing: border-box;
        transition: background 0.15s ease;
      }

      .tb-left-item + .tb-left-item {
        margin-top: 4px;
      }

      .tb-left-item:hover {
        background: rgba(8, 184, 232, 0.06);
      }

      /* Tool buttons: icon ABOVE text, centred (default behaviour) */
      .tb-left-item.tool-button {
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        text-align: center;
        padding: 12px 4px 10px;
        gap: 6px;
        border-radius: 18px;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        transition: none !important;
        min-height: 72px; /* enough room for 44px icon + 2-line label */
      }

      /* Don’t apply hover background / shadows on these tools */
      .tb-left-item.tool-button:hover,
      .tb-left-item.tool-button:focus,
      .tb-left-item.tool-button:active {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        transform: none !important;
      }

      /* Extra vertical spacing between tool buttons */
      .tb-left-item.tool-button + .tb-left-item.tool-button {
        margin-top: 8px;
      }

      /* Icon size – no stretching */
      .tb-left-item.tool-button img.tb-tool-icon {
        width: 44px;
        height: 44px;
        display: block;
        flex-shrink: 0;
        object-fit: contain;
      }

      /* Icon swap dark → blue */
      .tb-left-item.tool-button img.icon-dark {
        display: block;
      }

      .tb-left-item.tool-button img.icon-blue {
        display: none;
      }

      .tb-left-item.tool-button:hover img.icon-dark {
        display: none;
      }

      .tb-left-item.tool-button:hover img.icon-blue {
        display: block;
      }

      .tb-left-item.tool-button.is-active img.icon-dark {
        display: none;
      }

      .tb-left-item.tool-button.is-active img.icon-blue {
        display: block;
      }

      .tb-left-item.tool-button .tb-left-label {
        display: block;
        font-size: 11px;
        line-height: 1.2;
        font-weight: 500;
        color: var(--tixall-dark);
        white-space: normal;
        text-align: center;
        max-width: 80px;        /* stop text running wider than icon */
        word-break: break-word; /* wrap long words instead of overlap */
      }

      /* Fly-out tool groups (Photoshop-style) */
      .tool-group {
        position: relative;
        margin-bottom: 8px;
      }

      /* Top-level group buttons: row layout so chevron sits to the right */
      .tool-group > .tb-left-item.tool-button {
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        min-height: 44px;
        padding: 8px 10px;
      }

      .tool-group > .tb-left-item.tool-button img.tb-tool-icon {
        width: 28px;
        height: 28px;
      }

      .tool-group > .tb-left-item.tool-button .tb-left-label {
        max-width: none;
        text-align: left;
      }

      .tool-group > .tb-left-item.tool-button .tool-flyout-chevron {
        margin-left: auto; /* push arrow to the far right */
      }

      .tool-flyout-chevron {
        font-size: 10px;
        opacity: 0.7;
      }

      .tool-flyout {
        position: absolute;
        left: 100%;
        top: 0;
        display: none;
        flex-direction: column;
        gap: 4px;
        padding: 6px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(15,23,42,0.20);
        border: 1px solid rgba(148,163,184,0.35);
        z-index: 9999; /* float above canvas and side panels */
        min-width: 160px;
        margin-left: 8px;
      }

      .tool-group:hover .tool-flyout {
        display: flex;
      }

      .tool-flyout .tb-left-item.tool-button {
        min-height: 0;
        padding: 8px 10px;
        flex-direction: row;
        justify-content: flex-start;
        text-align: left;
        border-radius: 12px;
        gap: 8px;
      }

      .tool-flyout .tb-left-item.tool-button .tb-left-label {
        max-width: none;
      }

      .tool-flyout .tb-left-item.tool-button img.tb-tool-icon {
        width: 24px;
        height: 24px;
      }

      /* Undo / Redo / Clear chips */
      .tb-left-icon {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        background: var(--tixall-grey-soft);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .tb-left-item.tb-left-item-danger {
        color: #b3261e;
      }

      .tb-left-item.tb-left-item-danger .tb-left-icon {
        background: #ffeceb;
      }

      /* Centre canvas area border tweak to feel lighter */
      .tb-center-header {
        border-bottom: 1px solid var(--tixall-border-subtle);
        background: #ffffff;
      }

      .tb-tab.is-active {
        color: var(--tixall-dark);
        border-bottom-color: var(--tixall-blue);
      }

      .tb-zoom-btn.tb-zoom-label {
        border-radius: 999px;
        border-color: var(--tixall-border-subtle);
        background: #ffffff;
      }

      /* Right side panel subtle styling */
      .tb-side-panel {
        background: #fbfcfe;
        border-left: 1px solid var(--tixall-border-subtle);
      }

      .tb-side-section {
        border-radius: 18px;
        border: 1px solid var(--tixall-border-subtle);
        background: #ffffff;
      }

      .tb-side-heading {
        color: var(--tixall-dark);
      }
    </style>
  </head>
  <body class="tickin-builder-body">
    <div class="tickin-builder-shell">
      <header class="tickin-builder-topbar">
        <div class="tb-topbar-left">
          <div class="tb-logo-badge">
            <span class="tb-logo-dot"></span>
            <span class="tb-logo-text">TickIn Builder</span>
          </div>
          <div class="tb-show-meta">
            <h1 class="tb-show-title" id="tb-show-title">Seat map designer</h1>
            <div class="tb-show-subtitle">
              <span id="tb-show-venue">Loading show details…</span>
              <span class="tb-dot">·</span>
              <span id="tb-show-date"></span>
            </div>
          </div>
        </div>
        <div class="tb-topbar-right">
          <button type="button" class="tb-topbar-btn tb-btn-ghost" id="tb-btn-back">
            Back to wizard
          </button>
          <button type="button" class="tb-topbar-btn tb-btn-primary" id="tb-btn-save">
            Save layout
          </button>
        </div>
      </header>

      <main class="tickin-builder-main">
        <!-- Slim, non-expanding left rail -->
        <aside class="tb-left-rail" aria-label="Seating tools">
          <div class="tb-left-scroll">
            <div class="tb-left-group">
              <div class="tb-left-group-label">Seating</div>

              <!-- Group: Line + Section -->
              <div class="tool-group">
                <button class="tb-left-item tool-button" data-tool="line">
                  <img
                    class="tb-tool-icon icon-dark"
                    src="/seatmap-icons/line-black.png"
                    alt="Line"
                  />
                  <img
                    class="tb-tool-icon icon-blue"
                    src="/seatmap-icons/line-blue.png"
                    alt="Line (selected)"
                  />
                  <span class="tb-left-label">Line / section</span>
                  <span class="tool-flyout-chevron">▾</span>
                </button>

                <div class="tool-flyout">
                  <button class="tb-left-item tool-button" data-tool="line">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/line-black.png"
                      alt="Line"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/line-blue.png"
                      alt="Line (selected)"
                    />
                    <span class="tb-left-label">Line</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="section">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/section-dark.png"
                      alt="Section block"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/section-blue.png"
                      alt="Section block (selected)"
                    />
                    <span class="tb-left-label">Section block</span>
                  </button>
                </div>
              </div>

              <!-- Group: Rows + Single seat -->
              <div class="tool-group">
                <button class="tb-left-item tool-button" data-tool="row">
                  <img
                    class="tb-tool-icon icon-dark"
                    src="/seatmap-icons/row-black.png"
                    alt="Row of seats"
                  />
                  <img
                    class="tb-tool-icon icon-blue"
                    src="/seatmap-icons/row-blue.png"
                    alt="Row of seats (selected)"
                  />
                  <span class="tb-left-label">Rows / single</span>
                  <span class="tool-flyout-chevron">▾</span>
                </button>

                <div class="tool-flyout">
                  <button class="tb-left-item tool-button" data-tool="row">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/row-black.png"
                      alt="Row of seats"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/row-blue.png"
                      alt="Row of seats (selected)"
                    />
                    <span class="tb-left-label">Row of seats</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="single">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/single-dark.png"
                      alt="Single seat"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/single-blue.png"
                      alt="Single seat (selected)"
                    />
                    <span class="tb-left-label">Single seat</span>
                  </button>
                </div>
              </div>

              <!-- Group: Tables -->
              <div class="tool-group">
                <button class="tb-left-item tool-button" data-tool="circle-table">
                  <img
                    class="tb-tool-icon icon-dark"
                    src="/seatmap-icons/circle-table-black.png"
                    alt="Circular table"
                  />
                  <img
                    class="tb-tool-icon icon-blue"
                    src="/seatmap-icons/circle-table-blue.png"
                    alt="Circular table (selected)"
                  />
                  <span class="tb-left-label">Tables</span>
                  <span class="tool-flyout-chevron">▾</span>
                </button>

                <div class="tool-flyout">
                  <button class="tb-left-item tool-button" data-tool="circle-table">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/circle-table-black.png"
                      alt="Circular table"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/circle-table-blue.png"
                      alt="Circular table (selected)"
                    />
                    <span class="tb-left-label">Circular table</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="rect-table">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/rectangle-table-black.png"
                      alt="Rectangular table"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/rectangle-table-blue.png"
                      alt="Rectangular table (selected)"
                    />
                    <span class="tb-left-label">Rectangular table</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="tb-left-group">
              <div class="tb-left-group-label">Room &amp; labelling</div>

              <!-- Group: Stage / Bar / Exit -->
              <div class="tool-group">
                <button class="tb-left-item tool-button" data-tool="stage">
                  <img
                    class="tb-tool-icon icon-dark"
                    src="/seatmap-icons/stage-dark.png"
                    alt="Stage"
                  />
                  <img
                    class="tb-tool-icon icon-blue"
                    src="/seatmap-icons/stage-blue.png"
                    alt="Stage (selected)"
                  />
                  <span class="tb-left-label">Room objects</span>
                  <span class="tool-flyout-chevron">▾</span>
                </button>

                <div class="tool-flyout">
                  <button class="tb-left-item tool-button" data-tool="stage">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/stage-dark.png"
                      alt="Stage"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/stage-blue.png"
                      alt="Stage (selected)"
                    />
                    <span class="tb-left-label">Stage</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="bar">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/bar-dark.png"
                      alt="Bar / kiosk"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/bar-blue.png"
                      alt="Bar / kiosk (selected)"
                    />
                    <span class="tb-left-label">Bar / kiosk</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="exit">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/exit-black.png"
                      alt="Exit"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/exit-blue.png"
                      alt="Exit (selected)"
                    />
                    <span class="tb-left-label">Exit</span>
                  </button>
                </div>
              </div>

              <!-- Text label (standalone tool) -->
              <button class="tb-left-item tool-button" data-tool="text">
                <img
                  class="tb-tool-icon icon-dark"
                  src="/seatmap-icons/Text-black.png"
                  alt="Text label"
                />
                <img
                  class="tb-tool-icon icon-blue"
                  src="/seatmap-icons/Text-blue.png"
                  alt="Text label (selected)"
                />
                <span class="tb-left-label">Text label</span>
              </button>
            </div>

            <div class="tb-left-group">
              <div class="tb-left-group-label">Actions</div>

              <!-- Leaving these using existing icon fonts/spans for now -->
              <button class="tb-left-item" id="sb-undo">
                <span class="tb-left-icon tb-icon-undo"></span>
                <span class="tb-left-label">Undo</span>
              </button>

              <button class="tb-left-item" id="sb-redo">
                <span class="tb-left-icon tb-icon-redo"></span>
                <span class="tb-left-label">Redo</span>
              </button>

              <button class="tb-left-item tb-left-item-danger" id="sb-clear">
                <span class="tb-left-icon tb-icon-clear"></span>
                <span class="tb-left-label">Clear canvas</span>
              </button>
            </div>
          </div>
        </aside>

        <section class="tb-center">
          <div class="tb-center-header">
            <div class="tb-tabs">
              <button class="tb-tab is-active" data-tab="map">Map</button>
              <button class="tb-tab" data-tab="tiers">Tiers</button>
              <button class="tb-tab" data-tab="holds">Holds</button>
            </div>

            <div class="tb-zoom-toolbar" aria-label="Zoom">
              <button class="tb-zoom-btn" id="sb-zoom-out">−</button>
              <button class="tb-zoom-btn tb-zoom-label" id="sb-zoom-reset">100%</button>
              <button class="tb-zoom-btn" id="sb-zoom-in">+</button>
            </div>
          </div>

          <div class="tb-tab-panels">
            <div class="tb-tab-panel is-active" id="tb-tab-map">
              <div id="app"></div>
            </div>
            <div class="tb-tab-panel" id="tb-tab-tiers">
              <div class="tb-empty-panel">
                <h2>Tiers coming soon</h2>
                <p>Set up pricing tiers and link them to sections and seats.</p>
              </div>
            </div>
            <div class="tb-tab-panel" id="tb-tab-holds">
              <div class="tb-empty-panel">
                <h2>Holds coming soon</h2>
                <p>Reserve blocks of seats for guests, agents, or sponsors.</p>
              </div>
            </div>
          </div>
        </section>

        <aside class="tb-side-panel">
          <section class="tb-side-section">
            <h3 class="tb-side-heading">Layout summary</h3>
            <div class="tb-side-meta">
              <div>
                <dt>Show</dt>
                <dd id="tb-meta-show-title">
                  <span id="sb-inspector-show">Loading…</span>
                </dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd id="tb-meta-venue-name">
                  <span id="sb-inspector-venue">–</span>
                </dd>
              </div>
              <div>
                <dt>Estimated capacity</dt>
                <dd id="tb-meta-capacity">Flexible</dd>
              </div>
              <div>
                <dt>Seats on map</dt>
                <dd id="sb-seat-count">0 seats</dd>
              </div>
            </div>
          </section>

          <section class="tb-side-section">
            <h3 class="tb-side-heading">Selection</h3>
            <div id="sb-inspector" class="tb-inspector">
              <p class="sb-inspector-empty">
                Click on a seat, table or object to edit its settings.
              </p>
            </div>
          </section>

          <section class="tb-side-section">
            <h3 class="tb-side-heading">Saved layouts</h3>
            <p class="tb-side-help">
              Re-use layouts across shows at the same venue. Coming soon: click to switch.
            </p>
            <div class="tb-saved-list" id="tb-saved-list"></div>
          </section>
        </aside>
      </main>
    </div>

    <script>
      (function () {
        var showId = ${JSON.stringify(showId)};
        var layout = ${JSON.stringify(layout)};

        // Expose to seating-builder.js
        // @ts-ignore
        window.__SEATMAP_SHOW_ID__ = showId;
        // @ts-ignore
        window.__SEATMAP_LAYOUT__ = layout;
        // @ts-ignore
        window.__TICKIN_SAVE_BUTTON__ = document.getElementById("tb-btn-save");
        // @ts-ignore
        window.__TICKIN_BACK_BUTTON__ = document.getElementById("tb-btn-back");

        var tabs = document.querySelectorAll(".tb-tab");
        var panels = {
          map: document.getElementById("tb-tab-map"),
          tiers: document.getElementById("tb-tab-tiers"),
          holds: document.getElementById("tb-tab-holds"),
        };

        tabs.forEach(function (tab) {
          tab.addEventListener("click", function () {
            var target = tab.getAttribute("data-tab");
            if (!target || !panels[target]) return;

            tabs.forEach(function (t) {
              t.classList.remove("is-active");
            });
            Object.keys(panels).forEach(function (key) {
              panels[key].classList.remove("is-active");
            });

            tab.classList.add("is-active");
            panels[target].classList.add("is-active");
          });
        });

        fetch("/admin/seating/builder/api/seatmaps/" + encodeURIComponent(showId))
          .then(function (res) {
            return res.ok ? res.json() : null;
          })
          .then(function (data) {
            if (!data || !data.show) return;
            var show = data.show;
            var venue = show.venue || null;

            var titleEl = document.getElementById("tb-show-title");
            var venueEl = document.getElementById("tb-show-venue");
            var dateEl = document.getElementById("tb-show-date");
            var metaShowTitle = document.getElementById("tb-meta-show-title");
            var metaVenueName = document.getElementById("tb-meta-venue-name");
            var metaCapacity = document.getElementById("tb-meta-capacity");

            if (titleEl) titleEl.textContent = show.title || "Seat map designer";
            if (venueEl) {
              if (venue) {
                var cityPart = venue.city ? " · " + venue.city : "";
                venueEl.textContent = venue.name + cityPart;
              } else {
                venueEl.textContent = "Venue not set";
              }
            }
            if (dateEl && show.date) {
              try {
                var d = new Date(show.date);
                var opts = { day: "numeric", month: "short", year: "numeric" };
                dateEl.textContent = d.toLocaleDateString("en-GB", opts);
              } catch (_) {}
            }

            if (metaShowTitle) metaShowTitle.textContent = show.title || "Untitled show";
            if (metaVenueName) {
              metaVenueName.textContent = venue ? venue.name : "TBC";
            }
            if (metaCapacity && venue && typeof venue.capacity === "number") {
              metaCapacity.textContent = String(venue.capacity);
            }

            var listEl = document.getElementById("tb-saved-list");
            if (listEl && Array.isArray(data.previousMaps)) {
              data.previousMaps.forEach(function (m) {
                var div = document.createElement("div");
                div.className = "tb-saved-item";
                var title = document.createElement("div");
                title.className = "tb-saved-item-title";
                title.textContent = m.name || "Layout";
                var meta = document.createElement("div");
                meta.className = "tb-saved-item-meta";
                var ver = document.createElement("span");
                ver.textContent = "v" + (m.version || 1);
                var when = document.createElement("span");
                try {
                  var d2 = new Date(m.createdAt);
                  when.textContent = d2.toLocaleDateString("en-GB");
                } catch (_) {
                  when.textContent = "";
                }
                meta.appendChild(ver);
                meta.appendChild(when);
                div.appendChild(title);
                div.appendChild(meta);
                listEl.appendChild(div);
              });
            }
          })
          .catch(function (err) {
            console.error("Failed to load show info for builder", err);
          });

        var backBtn = document.getElementById("tb-btn-back");
        if (backBtn) {
          backBtn.addEventListener("click", function () {
            if (window.history.length > 1) {
              window.history.back();
            }
          });
        }
      })();
    </script>

    <script src="https://unpkg.com/konva@9.3.3/konva.min.js"></script>
    <script src="/static/seating-builder.js"></script>
  </body>
</html>`;

  res.status(200).send(html);
});

export default router;
