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
          showId,
          venueId: showRow.venueId,
          name: finalName,
          layout: layoutPayload as any,
          isTemplate: !!saveAsTemplate,
          createdByUserId: userId,
        },
      });
    }

    return res.json({
      success: true,
      seatMapId: saved.id,
      name: saved.name,
      layout: saved.layout,
      version: saved.version,
    });
  } catch (err) {
    console.error("Error in POST /builder/api/seatmaps/:showId", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/* -------------------------------------------------------------
   ROUTE: POST mark seat map as default
-------------------------------------------------------------- */
router.post("/builder/api/seatmaps/:showId/default", async (req, res) => {
  try {
    const showId = req.params.showId;
    const { seatMapId } = req.body ?? {};

    if (!seatMapId) {
      return res.status(400).json({ error: "Missing seatMapId" });
    }

    // Clear existing defaults for this show
    await prisma.seatMap.updateMany({
      where: { showId },
      data: { isDefault: false },
    });

    // Set the chosen one as default
    await prisma.seatMap.update({
      where: { id: seatMapId },
      data: { isDefault: true },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in POST /builder/api/seatmaps/:showId/default", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/* -------------------------------------------------------------
   ROUTE: GET admin seating builder page
-------------------------------------------------------------- */
router.get("/builder/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;

    // Fetch show basics + venue ID, plus any active layout
    const showRows = await prisma.$queryRaw<
      { id: string; title: string | null; venueId: string | null; date: Date | null }[]
    >`SELECT "id","title","venueId","date" FROM "Show" WHERE "id" = ${showId} LIMIT 1`;

    if (!showRows[0]) {
      return res.status(404).send("Show not found");
    }

    const show = showRows[0];

    // The most recent seat map saved for this show
    const savedSeatMap = await prisma.seatMap.findFirst({
      where: { showId },
      orderBy: { createdAt: "desc" },
    });

    // NOTE: We must escape layout JSON for safe inline use
    const layout = savedSeatMap?.layout ? JSON.stringify(savedSeatMap.layout) : "null";

    return res.send(`<!DOCTYPE html>
<html lang="en" class="sb-layout">
  <head>
    <meta charset="UTF-8" />
    <title>Seat map designer – TixAll</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="/static/seatmap-builder.css" />
    <script src="https://unpkg.com/konva@9/konva.min.js"></script>
    <style>
      /* Basic reset and typography */
      :root {
        --tixall-blue: #4f46e5;
        --tixall-blue-dark: #4338ca;
        --tixall-orange: #f97316;
        --tixall-dark: #111827;
        --tixall-text: #1f2937;
        --tixall-subtext: #6b7280;
        --tixall-border: #e5e7eb;
        --tixall-border-subtle: rgba(148, 163, 184, 0.35);
        --tixall-bg: #f8fafc;
        --tixall-bg-2: #eef2ff;
      }

      body.tickin-builder-body {
        margin: 0;
        padding: 0;
        background: var(--tixall-bg);
        color: var(--tixall-text);
        font-family: -apple-system, BlinkMacSystemFont, "system-ui", "Segoe UI", sans-serif;
        min-height: 100vh;
      }

      .tickin-builder-shell {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .tickin-builder-topbar {
        position: sticky;
        top: 0;
        z-index: 30;
        background: #ffffff;
        border-bottom: 1px solid var(--tixall-border);
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .tb-topbar-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .tb-logo-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 14px;
        background: radial-gradient(circle at 10% 20%, rgba(79, 70, 229, 0.12), transparent 40%),
          #f8fafc;
        color: var(--tixall-dark);
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      .tb-logo-dot {
        width: 10px;
        height: 10px;
        background: var(--tixall-blue);
        border-radius: 999px;
        box-shadow: 0 0 0 6px rgba(79, 70, 229, 0.12);
      }

      .tb-logo-text {
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .tb-show-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .tb-show-title {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
        color: var(--tixall-dark);
      }

      .tb-show-subtitle {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--tixall-subtext);
        font-size: 13px;
      }

      .tb-dot {
        color: #cbd5e1;
      }

      .tb-topbar-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .tb-topbar-select {
        min-width: 200px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--tixall-border);
        background: #f9fafb;
        color: var(--tixall-text);
        font-weight: 600;
      }

      .tb-topbar-btn {
        border: 1px solid var(--tixall-border);
        border-radius: 12px;
        padding: 10px 14px;
        font-weight: 700;
        cursor: pointer;
        background: #ffffff;
        transition: all 0.2s ease;
      }

      .tb-btn-ghost {
        color: var(--tixall-subtext);
      }

      .tb-btn-primary {
        background: linear-gradient(120deg, var(--tixall-blue), #7c3aed);
        color: white;
        border: none;
        box-shadow: 0 10px 30px rgba(79, 70, 229, 0.25);
      }

      .tb-btn-primary:hover {
        transform: translateY(-1px);
      }

      .tickin-builder-main {
        flex: 1;
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr) 320px;
        gap: 16px;
        padding: 18px;
      }

      /* Left rail */
      .tb-left-rail {
        background: #ffffff;
        border: 1px solid var(--tixall-border-subtle);
        border-radius: 20px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
      }

      .tb-left-scroll {
        overflow-y: auto;
        max-height: calc(100vh - 180px);
        padding-right: 6px;
      }

      .tb-left-group {
        padding: 10px;
        border-radius: 14px;
        border: 1px solid var(--tixall-border-subtle);
        background: #f8fafc;
        margin-bottom: 12px;
      }

      .tb-left-group-label {
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--tixall-subtext);
        margin-bottom: 8px;
      }

      .tb-left-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid transparent;
        background: white;
        color: var(--tixall-text);
        font-weight: 700;
        cursor: pointer;
        transition: all 0.18s ease;
        text-align: left;
      }

      .tb-left-item:hover {
        border-color: var(--tixall-border);
        box-shadow: 0 10px 30px rgba(79, 70, 229, 0.08);
      }

      .tb-left-icon {
        width: 22px;
        height: 22px;
        display: inline-block;
      }

      .tb-left-label {
        flex: 1;
        font-size: 14px;
      }

      .tb-left-item-danger {
        color: #b91c1c;
        background: rgba(248, 113, 113, 0.1);
      }

      .tb-left-item-danger:hover {
        background: rgba(248, 113, 113, 0.18);
        border-color: rgba(248, 113, 113, 0.3);
      }

      .tool-group {
        border: 1px dashed var(--tixall-border);
        border-radius: 12px;
        padding: 6px;
        margin-bottom: 8px;
        background: #ffffff;
      }

      .tool-root {
        background: linear-gradient(120deg, rgba(79, 70, 229, 0.05), rgba(99, 102, 241, 0.12));
        border-color: rgba(79, 70, 229, 0.25);
      }

      .tool-flyout-toggle {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0 8px;
        color: var(--tixall-subtext);
      }

      .tool-flyout {
        margin: 6px 0 0 0;
        border-top: 1px dashed var(--tixall-border);
        padding-top: 6px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
      }

      .tb-tool-icon {
        width: 20px;
        height: 20px;
      }

      .icon-blue {
        display: none;
      }

      .tool-button.tool-active .icon-blue {
        display: inline;
      }

      .tool-button.tool-active .icon-dark {
        display: none;
      }

      /* Center column */
      .tb-center {
        background: #ffffff;
        border-radius: 20px;
        border: 1px solid var(--tixall-border-subtle);
        padding: 14px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .tb-center-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .tb-tabs {
        display: inline-flex;
        gap: 6px;
        background: #f1f5f9;
        padding: 6px;
        border-radius: 14px;
      }

      .tb-tab {
        border: none;
        background: transparent;
        padding: 10px 12px;
        border-radius: 12px;
        font-weight: 700;
        color: var(--tixall-subtext);
        cursor: pointer;
        transition: all 0.16s ease;
      }

      .tb-tab.is-active {
        background: white;
        color: var(--tixall-dark);
        box-shadow: 0 12px 30px rgba(79, 70, 229, 0.12);
      }

      .tb-zoom-toolbar {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #0f172a;
        color: white;
        padding: 8px;
        border-radius: 14px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.25);
      }

      .tb-zoom-btn {
        border: none;
        background: rgba(255, 255, 255, 0.08);
        color: white;
        padding: 8px 10px;
        border-radius: 10px;
        font-weight: 700;
        cursor: pointer;
      }

      .tb-zoom-label {
        background: rgba(255, 255, 255, 0.15);
      }

      .tb-tab-panels {
        border-radius: 16px;
        background: #f8fafc;
        border: 1px solid var(--tixall-border-subtle);
        min-height: 500px;
        position: relative;
        overflow: hidden;
      }

      #app {
        position: relative;
        min-height: 480px;
        background: #ffffff;
        border-radius: 16px;
        border: 1px dashed #e2e8f0;
        box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
      }

      .tb-tab-panel {
        display: none;
        padding: 12px;
      }

      .tb-tab-panel.is-active {
        display: block;
      }

      /* Right column */
      .tb-side-panel {
        background: #fbfcfe;
        border: 1px solid var(--tixall-border-subtle);
        display: flex;
        flex-direction: column;
        padding: 16px;
        min-width: 320px;
        max-width: 420px;
        overflow-y: auto;   /* vertical scroll lives here */
      }

      .tb-side-section {
        border-radius: 18px;
        border: 1px solid var(--tixall-border-subtle);
        background: #ffffff;
        padding: 14px 16px;
        margin-bottom: 12px;
      }

      /* --- BLOCKER FIX (unchanged) --- */

      .tb-empty-panel {
        /* Forces mouse events to pass through this element to the canvas below */
        pointer-events: none !important;
      }

      /* Bypasses the main tab content container (the new blocker) */
      .tb-tab-panel {
        /* Forces mouse events to pass through this element */
        pointer-events: none !important;
      }

      /* Ensure the canvas element itself is always above other content.
         Konva stages create their own div/canvas elements inside the container (#app). */
      #app > div {
        z-index: 1 !important; /* Forces the internal Konva div to be the highest layer */
      }

      .tb-side-heading {
        color: var(--tixall-dark);
      }


    </style>
  </head>
  <body class="tickin-builder-body">
    <div class="tickin-builder-shell sb-admin-page">
      <header class="tickin-builder-topbar sb-admin-header">
        <div class="tb-topbar-left">
          <div class="tb-logo-badge">
            <span class="tb-logo-dot"></span>
            <span class="tb-logo-text">TIXALL Builder</span>
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
          <button
            type="button"
            class="tb-topbar-btn tb-btn-ghost"
            id="tb-btn-delete"
            style="display: none;"
            disabled
          >
            Delete layout
          </button>
          <select
            id="tb-saved-layout-select"
            class="tb-topbar-select"
            aria-label="Saved layouts for this venue"
          >
            <option value="" disabled selected>Loading saved layouts…</option>
          </select>

          <button type="button" class="tb-topbar-btn tb-btn-ghost" id="tb-btn-back">
            Back to wizard
          </button>
          <button
            type="button"
            class="tb-topbar-btn tb-btn-ghost"
            id="tb-btn-load"
          >
            Load saved layout
          </button>
          <button type="button" class="tb-topbar-btn tb-btn-primary" id="tb-btn-save">
            Save layout
          </button>
        </div>

      </header>

      <main class="tickin-builder-main sb-admin-main">
        <div class="sb-mobile-fixed-top">
        <!-- Slim, non-expanding left rail -->
        <div class="sb-mobile-toolbar">
               <aside class="tb-left-rail sb-elements-panel" aria-label="Seating tools">
          <div class="tb-left-scroll">
            <!-- Seating tools – icon + text only (no sub-heading) -->
            <div class="tb-left-group">
              <!-- Group: Line + Section -->
                            <div class="tool-group" data-group="line-section">
                <button class="tb-left-item tool-button tool-root" data-tool="line">
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
                  <span class="tb-left-label">Line / shapes</span>
                </button>
                <button class="tool-flyout-toggle" type="button" aria-label="More line tools">
                  <span class="tool-flyout-chevron">▸</span>
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

                                    <!-- NEW: Curved line tool -->
                  <button class="tb-left-item tool-button" data-tool="curve-line">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/line-black.png"
                      alt="Curved line"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/line-blue.png"
                      alt="Curved line (selected)"
                    />
                    <span class="tb-left-label">Curved line</span>
                  </button>

                  <!-- NEW: Arc tool (separate from curved line) -->
                  <button class="tb-left-item tool-button" data-tool="arc">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/line-black.png"
                      alt="Arc"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/line-blue.png"
                      alt="Arc (selected)"
                    />
                    <span class="tb-left-label">Arc</span>
                  </button>

                  <!-- NEW: Arrow tool -->
                  <button class="tb-left-item tool-button" data-tool="arrow">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/line-black.png"
                      alt="Arrow"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/line-blue.png"
                      alt="Arrow (selected)"
                    />
                    <span class="tb-left-label">Arrow</span>
                  </button>

                  <!-- NEW: Stairs tool (Line / shapes fly-out) -->
<button class="tb-left-item tool-button" data-tool="stairs">
  <img
    class="tb-tool-icon icon-dark"
    src="/seatmap-icons/stairssymbol-dark.png"
    alt="Stairs"
  />
  <img
    class="tb-tool-icon icon-blue"
    src="/seatmap-icons/stairssymbol-blue.png"
    alt="Stairs (selected)"
  />
  <span class="tb-left-label">Stairs</span>
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


                                    <!-- NEW: Square tool -->
                  <button class="tb-left-item tool-button" data-tool="square">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/section-dark.png"
                      alt="Square"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/section-blue.png"
                      alt="Square (selected)"
                    />
                    <span class="tb-left-label">Square</span>
                  </button>

                  <!-- NEW: Multi-tool (working tools) -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="multi"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/selection-dark.png"
                      alt="Multi-tool"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/selection-blue.png"
                      alt="Multi-tool (selected)"
                    />
                    <span class="tb-left-label">Multi-tool</span>
                  </button>

                  <!-- NEW: Arc text tool -->
                  <button class="tb-left-item tool-button" data-tool="arc-text">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/text-dark.png"
                      alt="Arc text"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/text-blue.png"
                      alt="Arc text (selected)"
                    />
                    <span class="tb-left-label">Arc text</span>
                  </button>

                  <!-- NEW: Text-on-path tool -->
                  <button class="tb-left-item tool-button" data-tool="text-on-path">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/text-dark.png"
                      alt="Text on path"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/text-blue.png"
                      alt="Text on path (selected)"
                    />
                    <span class="tb-left-label">Text on path</span>
                  </button>

                  <!-- NEW: Circular text tool -->
                  <button class="tb-left-item tool-button" data-tool="circular-text">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/text-dark.png"
                      alt="Circular text"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/text-blue.png"
                      alt="Circular text (selected)"
                    />
                    <span class="tb-left-label">Circular text</span>
                  </button>
                </div>
              </div>

              <!-- Group: Seats -->
              <div class="tool-group" data-group="seats">
                <button class="tb-left-item tool-button tool-root" data-tool="seat">
                  <img
                    class="tb-tool-icon icon-dark"
                    src="/seatmap-icons/seat-dark.png"
                    alt="Seat"
                  />
                  <img
                    class="tb-tool-icon icon-blue"
                    src="/seatmap-icons/seat-blue.png"
                    alt="Seat (selected)"
                  />
                  <span class="tb-left-label">Seats</span>
                </button>
                <button class="tool-flyout-toggle" type="button" aria-label="Seat tools">
                  <span class="tool-flyout-chevron">▸</span>
                </button>

                <div class="tool-flyout">
                  <button class="tb-left-item tool-button" data-tool="seat">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/seat-dark.png"
                      alt="Seat"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/seat-blue.png"
                      alt="Seat (selected)"
                    />
                    <span class="tb-left-label">Seat</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="stadium-seat">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/stadium-seat-dark.png"
                      alt="Stadium seat"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/stadium-seat-blue.png"
                      alt="Stadium seat (selected)"
                    />
                    <span class="tb-left-label">Stadium seat</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="couple-seat">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/couple-seat-dark.png"
                      alt="Couple seat"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/couple-seat-blue.png"
                      alt="Couple seat (selected)"
                    />
                    <span class="tb-left-label">Couple seat</span>
                  </button>
                </div>
              </div>

              <!-- Group: Tables -->
              <div class="tool-group" data-group="tables">
                <button class="tb-left-item tool-button tool-root" data-tool="round-table">
                  <img
                    class="tb-tool-icon icon-dark"
                    src="/seatmap-icons/table-round-dark.png"
                    alt="Tables"
                  />
                  <img
                    class="tb-tool-icon icon-blue"
                    src="/seatmap-icons/table-round-blue.png"
                    alt="Tables (selected)"
                  />
                  <span class="tb-left-label">Tables</span>
                </button>
                <button class="tool-flyout-toggle" type="button" aria-label="Table tools">
                  <span class="tool-flyout-chevron">▸</span>
                </button>

                <div class="tool-flyout">
                  <button class="tb-left-item tool-button" data-tool="round-table">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/table-round-dark.png"
                      alt="Round table"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/table-round-blue.png"
                      alt="Round table (selected)"
                    />
                    <span class="tb-left-label">Round table</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="rect-table">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/table-rect-dark.png"
                      alt="Rectangular table"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/table-rect-blue.png"
                      alt="Rectangular table (selected)"
                    />
                    <span class="tb-left-label">Rectangular table</span>
                  </button>

                  <!-- NEW: Square table -->
                  <button class="tb-left-item tool-button" data-tool="square-table">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/table-square-dark.png"
                      alt="Square table"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/table-square-blue.png"
                      alt="Square table (selected)"
                    />
                    <span class="tb-left-label">Square table</span>
                  </button>

                  <!-- NEW: Banquet table -->
                  <button class="tb-left-item tool-button" data-tool="banquet-table">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/table-banquet-dark.png"
                      alt="Banquet table"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/table-banquet-blue.png"
                      alt="Banquet table (selected)"
                    />
                    <span class="tb-left-label">Banquet table</span>
                  </button>
                </div>
              </div>

              <!-- Group: Stages, bars, symbols -->
              <div class="tool-group" data-group="stage-bar">
                <button class="tb-left-item tool-button tool-root" data-tool="stage">
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
                <button class="tool-flyout-toggle" type="button" aria-label="Stage and symbols">
                  <span class="tool-flyout-chevron">▸</span>
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

                  <button class="tb-left-item tool-button" data-tool="stage-triangle">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/stage-triangle-dark.png"
                      alt="Triangle stage"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/stage-triangle-blue.png"
                      alt="Triangle stage (selected)"
                    />
                    <span class="tb-left-label">Triangle stage</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="stage-pentagon">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/stage-pentagon-dark.png"
                      alt="Pentagon stage"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/stage-pentagon-blue.png"
                      alt="Pentagon stage (selected)"
                    />
                    <span class="tb-left-label">Pentagon stage</span>
                  </button>

                  <button class="tb-left-item tool-button" data-tool="bar">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/bar-dark.png"
                      alt="Bar"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/bar-blue.png"
                      alt="Bar (selected)"
                    />
                    <span class="tb-left-label">Bar</span>
                  </button>

                  <!-- NEW: Exit symbol -->
                  <button class="tb-left-item tool-button" data-tool="symbol-exit">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/exit-dark.png"
                      alt="Exit symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/exit-blue.png"
                      alt="Exit symbol (selected)"
                    />
                    <span class="tb-left-label">Exit</span>
                  </button>

                  <!-- NEW: Disabled/Wheelchair symbol -->
                  <button class="tb-left-item tool-button" data-tool="symbol-disabled">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/accessible-dark.png"
                      alt="Accessible symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/accessible-blue.png"
                      alt="Accessible symbol (selected)"
                    />
                    <span class="tb-left-label">Accessible</span>
                  </button>

                  <!-- NEW: First aid symbol -->
                  <button class="tb-left-item tool-button" data-tool="symbol-first-aid">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/first-aid-dark.png"
                      alt="First aid symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/first-aid-blue.png"
                      alt="First aid symbol (selected)"
                    />
                    <span class="tb-left-label">First aid</span>
                  </button>

                  <!-- NEW: Information symbol -->
                  <button class="tb-left-item tool-button" data-tool="symbol-info">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/info-dark.png"
                      alt="Information symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/info-blue.png"
                      alt="Information symbol (selected)"
                    />
                    <span class="tb-left-label">Information</span>
                  </button>

                  <!-- NEW: Mixed gender restroom symbol -->
                  <button class="tb-left-item tool-button" data-tool="symbol-wc-mixed">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/wc-mixed-dark.png"
                      alt="Restroom symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/wc-mixed-blue.png"
                      alt="Restroom symbol (selected)"
                    />
                    <span class="tb-left-label">WC (mixed)</span>
                  </button>

                  <!-- NEW: Male restroom symbol -->
                  <button class="tb-left-item tool-button" data-tool="symbol-wc-male">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/wc-male-dark.png"
                      alt="Restroom symbol (male)"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/wc-male-blue.png"
                      alt="Restroom symbol (male selected)"
                    />
                    <span class="tb-left-label">WC (male)</span>
                  </button>

                  <!-- NEW: Female restroom symbol -->
                  <button class="tb-left-item tool-button" data-tool="symbol-wc-female">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/wc-female-dark.png"
                      alt="Restroom symbol (female)"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/wc-female-blue.png"
                      alt="Restroom symbol (female selected)"
                    />
                    <span class="tb-left-label">WC (female)</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Actions – the only section with a heading -->
            <div class="tb-left-group tb-left-group-actions">
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
        </div>


        <section class="tb-center sb-seatmap-wrapper">
          <div class="tb-center-header">
            <div class="tb-tabs">
              <button class="tb-tab is-active" data-tab="map">Map</button>
              <button class="tb-tab" data-tab="tickets">Tickets</button>
              <button class="tb-tab" data-tab="holds">Holds</button>
              <button class="tb-tab" data-tab="view">View from Seats</button>
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
            <div class="tb-tab-panel" id="tb-tab-tickets">
              <div class="tb-empty-panel"></div>
            </div>
            <div class="tb-tab-panel" id="tb-tab-holds">
              <div class="tb-empty-panel">
                <h2>Holds coming soon</h2>
                <p>Reserve blocks of seats for guests, agents, or sponsors.</p>
              </div>
            </div>
            <div class="tb-tab-panel" id="tb-tab-view">
              <div class="tb-empty-panel">
                <h2>View from seats</h2>
                <p>Preview sightlines and viewpoints from any selected seat.</p>
              </div>
            </div>
          </div>
        </section>
        </div>

        <div class="sb-mobile-detail-panel sb-mobile-scroll-panel">
               <aside class="tb-side-panel sb-side-panel">
          <!-- Seats on map summary only -->
          <section class="tb-side-section">
            <h3 class="tb-side-heading">Seats on map</h3>
            <div class="tb-side-meta">
              <div>
                <dt>Total seats</dt>
                <dd id="sb-seat-count">0 seats</dd>
              </div>
            </div>
          </section>

          <!-- Element inspector (selection) -->
          <section class="tb-side-section">
            <h3 class="tb-side-heading">Selection</h3>
            <div id="sb-inspector" class="tb-inspector">
              <p class="sb-inspector-empty">
                Click on a seat, table or object to edit its settings.
              </p>
            </div>
          </section>
        </aside>
        </div>

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
        // @ts-ignore
        window.__TICKIN_LOAD_BUTTON__ = document.getElementById("tb-btn-load");
        // @ts-ignore
        window.__TICKIN_DELETE_BUTTON__ = document.getElementById("tb-btn-delete");

        // ----- TIXALL: layout save name + success handling -----
        var tixallLayoutName = null;

        var saveBtnEl = document.getElementById("tb-btn-save");
        if (saveBtnEl) {
          saveBtnEl.addEventListener(
            "click",
            function (ev) {
              // Run before seating-builder.js save handler
              if (!tixallLayoutName) {
                var defaultName = "";
                var venueText = document.getElementById("tb-show-venue");
                if (venueText && venueText.textContent) {
                  defaultName = venueText.textContent.trim() + " layout";
                } else {
                  defaultName = "My layout";
                }

                var entered = window.prompt("Name this layout", defaultName);
                if (!entered || !entered.trim()) {
                  // User cancelled / cleared – stop the save entirely
                  ev.preventDefault();
                  ev.stopImmediatePropagation();
                  return;
                }

                tixallLayoutName = entered.trim();
                // Optional: expose so later steps in the wizard know a named layout exists
                // @ts-ignore
                window.__TIXALL_CURRENT_LAYOUT_NAME__ = tixallLayoutName;
              }

            },
            true // capture, so this runs before other click listeners
          );
        }

        // Monkey-patch fetch so we can inject the name into the save payload
        var originalFetch = window.fetch;
        window.fetch = function (input, init) {
          var url =
            typeof input === "string"
              ? input
              : (input && input.url) || "";

          var isSeatMapSave =
            url.indexOf("/admin/seating/builder/api/seatmaps/") !== -1 &&
            init &&
            typeof init === "object";

          if (isSeatMapSave && tixallLayoutName) {
            try {
              var body = init.body ? JSON.parse(init.body as string) : {};
              body.name = tixallLayoutName;
              init.body = JSON.stringify(body);
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn("Failed to inject layout name into save payload", err);
            }
          }

          return originalFetch(input, init);
        };
      })();
    </script>
    <script src="/static/seating-builder.js"></script>
  </body>
</html>`);
  } catch (err) {
    console.error("Error in GET /builder/:showId", err);
    return res.status(500).send("Internal server error");
  }
});

export default router;