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
   ROUTE: DELETE a saved seat map
-------------------------------------------------------------- */
router.delete("/builder/api/seatmaps/:showId/:seatMapId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const seatMapId = req.params.seatMapId;

    const showRow = (
      await prisma.$queryRaw<{ id: string; venueId: string | null }[]>
        `SELECT "id","venueId" FROM "Show" WHERE "id" = ${showId} LIMIT 1`
    )[0];

    if (!showRow) {
      return res.status(404).json({ error: "Show not found" });
    }

    const scope: any[] = [{ showId }];
    if (showRow.venueId) {
      scope.push({ venueId: showRow.venueId });
    }

    const seatMap = await prisma.seatMap.findFirst({
      where: { id: seatMapId, OR: scope },
      select: { id: true },
    });

    if (!seatMap) {
      return res.status(404).json({ error: "Seat map not found" });
    }

    await prisma.seatMap.delete({ where: { id: seatMap.id } });

    return res.json({ ok: true, deletedId: seatMap.id });
  } catch (err) {
    console.error("Error in DELETE /builder/api/seatmaps/:showId/:seatMapId", err);
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
    <title>TIXALL Seat Designer</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="stylesheet" href="/static/seating-builder.css" />

    <!-- Brand + toolbar styling (inline so we can iterate quickly) -->
   <style>
    :root {
        /* BRANDING - TIXALL */
        --tixall-blue: #08B8E8;
        --tixall-blue-hover: #069ac4;
        --tixall-dark: #182828;
        
        /* STRUCTURE */
        --bg-main: #ffffff;
        --bg-contrast: #f8fafc;
        --border-subtle: #e2e8f0;
        --text-main: #0f172a;
        --text-muted: #64748b;
        
        /* STATUS */
        --status-success: #10B981;
    }

    body.tickin-builder-body {
        margin: 0;
        height: 100vh;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: var(--text-main);
        background: var(--bg-main);
        -webkit-font-smoothing: antialiased;
    }

    .tickin-builder-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
    }

    /* --- TOP HEADER --- */
    .tickin-builder-topbar {
        height: 60px;
        flex-shrink: 0;
        background: #ffffff;
        border-bottom: 1px solid var(--border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 20;
    }

    .tb-topbar-left { display: flex; align-items: center; gap: 16px; }
    
    .tb-logo-badge {
        background: var(--tixall-dark); color: #fff;
        padding: 6px 10px; border-radius: 6px; font-weight: 700; font-size: 13px;
        display: flex; gap: 8px; align-items: center;
    }
    .tb-logo-dot { width: 8px; height: 8px; background: var(--tixall-blue); border-radius: 50%; }
    
    .tb-show-meta { display: flex; flex-direction: column; justify-content: center; }
    .tb-show-title { font-size: 15px; font-weight: 700; margin: 0; line-height: 1.2; }
    .tb-show-subtitle { font-size: 12px; color: var(--text-muted); }

    .tb-topbar-right { display: flex; gap: 10px; align-items: center; }

    /* Header Buttons */
    .tb-topbar-btn {
        height: 36px; padding: 0 14px;
        border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        transition: all 0.2s;
    }
    .tb-btn-ghost { background: transparent; border: 1px solid var(--border-subtle); color: var(--text-main); }
    .tb-btn-ghost:hover { background: var(--bg-contrast); border-color: #cbd5e1; }
    
    .tb-btn-draft { background: #fff; border: 1px solid var(--border-subtle); color: var(--text-main); }
    .tb-btn-draft:hover { background: #f1f5f9; }

    .tb-btn-publish { background: var(--status-success); border: 1px solid var(--status-success); color: #fff; }
    .tb-btn-publish:hover:not(:disabled) { background: #059669; }
    .tb-btn-publish:disabled { background: #e2e8f0; border-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; }

    .tb-topbar-select {
        height: 36px; padding: 0 30px 0 10px; border-radius: 6px;
        border: 1px solid var(--border-subtle); font-size: 13px; cursor: pointer;
    }

    /* --- MAIN LAYOUT (Fixed Grid) --- */
    .tickin-builder-main {
        display: flex; /* Flex is safer than Grid for this specific layout */
        flex: 1;
        overflow: hidden;
    }

    /* --- LEFT RAIL (Fixed Width) --- */
    .tb-left-rail {
        width: 72px; /* Fixed narrow width */
        flex-shrink: 0;
        background: #ffffff;
        border-right: 1px solid var(--border-subtle);
        display: flex; flex-direction: column; align-items: center;
        padding-top: 16px;
        overflow-y: auto;
        z-index: 10;
    }

    /* Tool Buttons */
    .tb-left-item.tool-button {
        width: 56px; min-height: 56px;
        border: 1px solid transparent; background: transparent;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        margin-bottom: 8px; border-radius: 8px; cursor: pointer;
        color: var(--text-muted);
    }
    .tb-left-item.tool-button:hover { background: var(--bg-contrast); color: var(--tixall-blue); }
    .tb-left-item.tool-button.is-active {
        background: #eff6ff; border-color: #dbeafe; color: var(--tixall-blue);
    }
    .tb-tool-icon { width: 24px; height: 24px; object-fit: contain; margin-bottom: 4px; }
    .tb-left-label { font-size: 10px; font-weight: 600; text-align: center; line-height: 1.1; }

    /* Flyouts (Popups for tools) */
    .tool-group { position: relative; width: 100%; display: flex; justify-content: center; }
    .tool-flyout-toggle {
        position: absolute; right: 0; top: 50%; transform: translateY(-50%);
        font-size: 10px; color: #94a3b8; cursor: pointer; width: 16px; text-align: center;
    }
    .tool-flyout {
        position: absolute; left: 65px; top: 0;
        background: #fff; border: 1px solid var(--border-subtle);
        border-radius: 8px; padding: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        display: none; flex-direction: column; gap: 4px; min-width: 150px; z-index: 999;
    }
    .tool-group.is-open .tool-flyout { display: flex; }
    .tool-flyout .tb-left-item.tool-button {
        width: 100%; min-height: 40px; flex-direction: row; justify-content: flex-start; padding: 0 8px;
    }
    .tool-flyout .tb-left-item.tool-button .tb-left-label { margin-left: 10px; font-size: 13px; }
    .tool-flyout .tb-left-item.tool-button img { width: 20px; height: 20px; margin: 0; }

    /* --- CENTER CANVAS AREA --- */
    .tb-center {
        flex: 1;
        position: relative;
        background: #f1f5f9; /* Subtle gray contrast for map area */
        overflow: hidden;
        display: flex; flex-direction: column;
    }
    
    /* FLOATING TABS (The feature you liked) */
    .tb-center-header {
        position: absolute;
        top: 20px; left: 50%; transform: translateX(-50%);
        z-index: 100;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none; /* Allow clicks to pass through around tabs */
    }
    
    .tb-tabs {
        pointer-events: auto;
        background: #ffffff;
        padding: 4px;
        border-radius: 99px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        border: 1px solid rgba(0,0,0,0.05);
        display: flex; gap: 4px;
    }
    
    .tb-tab {
        padding: 8px 20px;
        border-radius: 99px;
        border: none;
        background: transparent;
        font-size: 13px; font-weight: 600; color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .tb-tab:hover { color: var(--text-main); background: #f8fafc; }
    
    /* ACTIVE TAB - TIXALL BLUE (Your Request) */
    .tb-tab.is-active {
        background: var(--tixall-blue);
        color: #ffffff;
        box-shadow: 0 2px 4px rgba(8, 184, 232, 0.3);
    }
    
    /* COMPLETED TAB - Green Tick */
    .tb-tab.is-complete {
        /* We keep text dark if not active, or white if active */
    }
    .tb-tab.is-complete::after { 
        content: ' ✓'; font-size: 11px; margin-left: 4px; font-weight: 800;
        color: var(--status-success); 
    }
    /* If active and complete, tick is white */
    .tb-tab.is-active.is-complete::after { color: #ffffff; }

    /* Zoom Controls (Floating Top Right) */
    .tb-zoom-toolbar {
        position: absolute; top: 20px; right: 20px;
        background: #fff; border-radius: 8px; border: 1px solid var(--border-subtle);
        display: flex; box-shadow: 0 2px 8px rgba(0,0,0,0.05); z-index: 100; pointer-events: auto;
    }
    .tb-zoom-btn { width: 32px; height: 32px; border: none; background: #fff; cursor: pointer; color: var(--text-main); }
    .tb-zoom-btn:hover { background: #f8fafc; }
    .tb-zoom-label { width: 48px; font-size: 12px; font-weight: 600; border-left: 1px solid #eee; border-right: 1px solid #eee; }

    /* Canvas Containers */
    .tb-tab-panels { flex: 1; position: relative; width: 100%; height: 100%; }
    .tb-tab-panel { display: none; width: 100%; height: 100%; }
    .tb-tab-panel.is-active { display: block; }
    
    /* Ensure Konva is Visible */
    #app { width: 100%; height: 100%; }
    #app > div { z-index: 1 !important; }

    /* --- RIGHT PANEL (Inspector) --- */
    .tb-side-panel {
        width: 360px; /* Fixed width */
        flex-shrink: 0;
        background: #ffffff;
        border-left: 1px solid var(--border-subtle);
        display: flex; flex-direction: column;
        padding: 20px;
        overflow-y: auto;
        z-index: 15;
    }
    
    .tb-side-section { margin-bottom: 24px; }
    
    .tb-side-heading {
        font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
        font-weight: 700; color: var(--text-muted); margin-bottom: 12px;
        border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;
    }
    
    /* Next Step Button (Tixall Blue) */
    .sb-next-step-btn {
        width: 100%;
        margin-top: 24px;
        padding: 14px;
        border-radius: 8px;
        border: none;
        background: var(--tixall-blue);
        color: #ffffff;
        font-weight: 700; font-size: 14px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(8, 184, 232, 0.2);
        transition: transform 0.1s, box-shadow 0.1s;
    }
    .sb-next-step-btn:hover {
        background: var(--tixall-blue-hover);
        transform: translateY(-1px);
        box-shadow: 0 6px 12px rgba(8, 184, 232, 0.3);
    }

    /* Interaction Fixes */
    .tb-empty-panel { pointer-events: none !important; }
    #tb-tab-tickets, #tb-tab-holds, #tb-tab-view { pointer-events: none !important; }
    #tb-tab-map { pointer-events: auto !important; }

</style>
  </head>
  <body class="tickin-builder-body">
    <div class="tickin-builder-shell">
      <header class="tickin-builder-topbar">
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
<button type="button" class="tb-topbar-btn tb-btn-draft" id="tb-btn-draft">
  Save Draft
</button>
<button type="button" class="tb-topbar-btn tb-btn-publish" id="tb-btn-publish" disabled>
  Publish Show
</button>
<button type="button" id="tb-btn-save" style="display:none;"></button>
</div>

      </header>

      <main class="tickin-builder-main">
        <!-- Slim, non-expanding left rail -->
               <aside class="tb-left-rail" aria-label="Seating tools">
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
                      alt="Multi shape"
                    />
                    <span class="tb-left-label">Multi-tool</span>
                  </button>

                  <!-- NEW: Circle tool -->
                  <button class="tb-left-item tool-button" data-tool="circle">
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/circle-table-black.png"
                      alt="Circle"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/circle-table-blue.png"
                      alt="Circle (selected)"
                    />
                    <span class="tb-left-label">Circle</span>
                  </button>
                </div>
              </div>

              <!-- Group: Rows + Single seat -->
              <div class="tool-group" data-group="rows-single">
                <button class="tb-left-item tool-button tool-root" data-tool="row">
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
                </button>
                <button class="tool-flyout-toggle" type="button" aria-label="More line tools">
  <span class="tool-flyout-chevron">▸</span>
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
              <div class="tool-group" data-group="tables">
                <button class="tb-left-item tool-button tool-root" data-tool="circle-table">
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
                </button>
                <button class="tool-flyout-toggle" type="button" aria-label="More line tools">
  <span class="tool-flyout-chevron">▸</span>
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

            <!-- Room objects – icon + text only (no sub-heading) -->
            <div class="tb-left-group">
              <!-- Group: Stage / Bar / Exit -->
              <div class="tool-group" data-group="room-objects">
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
                  <span class="tb-left-label">Room objects</span>
                </button>
                <button class="tool-flyout-toggle" type="button" aria-label="More line tools">
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

              <!-- NEW: Symbols submenu -->
              <div class="tool-group" data-group="symbols">
                <!-- Root "Symbols" button (just opens the fly-out) -->
                <button class="tb-left-item tool-button tool-root" type="button" data-tool="symbol-wc-mixed">
  <img
    class="tb-tool-icon icon-dark"
    src="/seatmap-icons/mixedtoilets-dark.png"
    alt="Symbols"
  />
  <img
    class="tb-tool-icon icon-blue"
    src="/seatmap-icons/mixedtoilets-blue.png"
    alt="Symbols (selected)"
  />
  <span class="tb-left-label">Symbols</span>
</button>

                <button
                  class="tool-flyout-toggle"
                  type="button"
                  aria-label="More symbol tools"
                >
                  <span class="tool-flyout-chevron">▸</span>
                </button>

                                <div class="tool-flyout">
                  <!-- BAR symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-bar"
                    data-icon-default="/seatmap-icons/barsymbol-dark.png"
                    data-icon-active="/seatmap-icons/barsymbol-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/barsymbol-dark.png"
                      alt="Bar symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/barsymbol-blue.png"
                      alt="Bar symbol (selected)"
                    />
                    <span class="tb-left-label">Bar</span>
                  </button>

                  <!-- Mixed WC symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-wc-mixed"
                    data-icon-default="/seatmap-icons/mixedtoilets-dark.png"
                    data-icon-active="/seatmap-icons/mixedtoilets-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/mixedtoilets-dark.png"
                      alt="Mixed toilets symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/mixedtoilets-blue.png"
                      alt="Mixed toilets symbol (selected)"
                    />
                    <span class="tb-left-label">Mixed WC</span>
                  </button>

                  <!-- Male WC symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-wc-male"
                    data-icon-default="/seatmap-icons/maletoilets-dark.png"
                    data-icon-active="/seatmap-icons/maletoilets-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/maletoilets-dark.png"
                      alt="Male toilets symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/maletoilets-blue.png"
                      alt="Male toilets symbol (selected)"
                    />
                    <span class="tb-left-label">Male WC</span>
                  </button>

                  <!-- Female WC symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-wc-female"
                    data-icon-default="/seatmap-icons/femaletoilets-dark.png"
                    data-icon-active="/seatmap-icons/femaletoilets-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/femaletoilets-dark.png"
                      alt="Female toilets symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/femaletoilets-blue.png"
                      alt="Female toilets symbol (selected)"
                    />
                    <span class="tb-left-label">Female WC</span>
                  </button>

                  <!-- Disabled WC symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-disabled"
                    data-icon-default="/seatmap-icons/disabledtoilets-dark.png"
                    data-icon-active="/seatmap-icons/disabledtoilets-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/disabledtoilets-dark.png"
                      alt="Accessible toilets symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/disabledtoilets-blue.png"
                      alt="Accessible toilets symbol (selected)"
                    />
                    <span class="tb-left-label">Accessible WC</span>
                  </button>

                  <!-- Emergency Exit symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-exit"
                    data-icon-default="/seatmap-icons/emergencyexit-dark.png"
                    data-icon-active="/seatmap-icons/emergencyexit-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/emergencyexit-dark.png"
                      alt="Emergency exit symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/emergencyexit-blue.png"
                      alt="Emergency exit symbol (selected)"
                    />
                    <span class="tb-left-label">Emergency exit</span>
                  </button>

                  <!-- First Aid symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-firstaid"
                    data-icon-default="/seatmap-icons/firstaid-dark.png"
                    data-icon-active="/seatmap-icons/firstaid-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/firstaid-dark.png"
                      alt="First aid symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/firstaid-blue.png"
                      alt="First aid symbol (selected)"
                    />
                    <span class="tb-left-label">First aid</span>
                  </button>

                  <!-- Information symbol -->
                  <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-info"
                    data-icon-default="/seatmap-icons/information-dark.png"
                    data-icon-active="/seatmap-icons/information-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/information-dark.png"
                      alt="Information symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/information-blue.png"
                      alt="Information symbol (selected)"
                    />
                    <span class="tb-left-label">Information</span>
                  </button>

                  <!-- NEW: Stairs symbol -->
                                    <button
                    class="tb-left-item tool-button"
                    data-tool="symbol-stairs"
                    data-icon-default="/seatmap-icons/stairssymbol-dark.png"
                    data-icon-active="/seatmap-icons/stairssymbol-blue.png"
                  >
                    <img
                      class="tb-tool-icon icon-dark"
                      src="/seatmap-icons/stairssymbol-dark.png"
                      alt="Stairs symbol"
                    />
                    <img
                      class="tb-tool-icon icon-blue"
                      src="/seatmap-icons/stairssymbol-blue.png"
                      alt="Stairs symbol (selected)"
                    />
                    <span class="tb-left-label">Stairs</span>
                  </button>
                </div>
              </div>

              <!-- Text label (standalone tool) -->



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


        <section class="tb-center">
          <div class="tb-center-header">
            <div class="tb-tabs">
              <button class="tb-tab is-active" data-tab="map">Map</button>
              <button class="tb-tab" data-tab="tickets">Tickets</button>
<button class="tb-tab" data-tab="holds">Holds & External Allocations</button>
<button class="tb-tab" data-tab="view">Seating Information and View from Seats</button>
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
    <div class="tb-empty-panel"></div>
</div>
<div class="tb-tab-panel" id="tb-tab-view">
              <div class="tb-tab-panel" id="tb-tab-view">
          <div class="tb-empty-panel">
            <h2>Seating Information and View from Seats</h2>
            <p>Assign sightline photos or information text to specific seats.</p>
          </div>
        </div>
        </div>
        </section>

               <aside class="tb-side-panel">
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
            (init.method === "POST" || init.method === "post");

          // Inject the layout name into the POST body if it's missing
          if (isSeatMapSave && tixallLayoutName && init && init.body) {
            try {
              if (typeof init.body === "string") {
                var parsed = JSON.parse(init.body);
                if (!parsed.name) {
                  parsed.name = tixallLayoutName;
                  init.body = JSON.stringify(parsed);
                }
              }
            } catch (e) {
              console.error(
                "TIXALL: failed to inject layout name into save payload",
                e
              );
            }
          }

          var result = originalFetch(input, init);

          return result.then(function (res) {
            if (isSeatMapSave && res && res.ok) {
              // Mark that a layout has been saved so other flows can respond.
              // @ts-ignore
              window.__TIXALL_LAYOUT_SAVED__ = true;
            }
            return res;
          });
        };

       var tabs = document.querySelectorAll(".tb-tab");
      var panels = {
        map: document.getElementById("tb-tab-map"),
        tickets: document.getElementById("tb-tab-tickets"),
        holds: document.getElementById("tb-tab-holds"),
        view: document.getElementById("tb-tab-view"), // <--- THIS LINE WAS MISSING
      };
        tabs.forEach(function (tab) {
          tab.addEventListener("click", function () {
            var target = tab.getAttribute("data-tab");
            if (!target || !panels[target]) return;

            tabs.forEach(function (t) {
              t.classList.remove("is-active");
            });
            Object.keys(panels).forEach(function (key) {
              if (key === "map") return;
              panels[key].classList.remove("is-active");
            });

            tab.classList.add("is-active");
            panels[target].classList.add("is-active");
            panels.map.classList.add("is-active");

            if (window.__TIXALL_SET_TAB_MODE__) {
              window.__TIXALL_SET_TAB_MODE__(target);
            }
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

            var savedSelect = document.getElementById("tb-saved-layout-select");
            var maps = [];

            if (data.activeSeatMap) {
              maps.push(data.activeSeatMap);
            }

            if (Array.isArray(data.previousMaps)) {
              data.previousMaps.forEach(function (m) {
                var exists = maps.some(function (existing) {
                  return existing.id === m.id;
                });
                if (!exists) maps.push(m);
              });
            }

            // Expose saved layouts globally so seating-builder.js can hook into them if needed
            // (e.g. to actually load / switch layouts when one is chosen).
            // @ts-ignore
            window.__TIXALL_SAVED_LAYOUTS__ = maps;

            if (savedSelect) {
              // Clear any placeholder options
              savedSelect.innerHTML = "";

              if (!maps.length) {
                var optEmpty = document.createElement("option");
                optEmpty.value = "";
                optEmpty.textContent = "No saved layouts for this venue";
                optEmpty.disabled = true;
                optEmpty.selected = true;
                savedSelect.appendChild(optEmpty);
              } else {
                // Placeholder prompt
                var optPlaceholder = document.createElement("option");
                optPlaceholder.value = "";
                optPlaceholder.textContent = "Choose a saved layout…";
                optPlaceholder.disabled = true;
                optPlaceholder.selected = true;
                savedSelect.appendChild(optPlaceholder);

                maps.forEach(function (m) {
                  var opt = document.createElement("option");
                  opt.value = m.id;
                  opt.textContent = m.name || "Layout";
                  savedSelect.appendChild(opt);
                });
              }

              // When a saved layout is chosen, delegate to seating-builder.js if it provides a handler.
              savedSelect.addEventListener("change", function () {
                var selectedId = savedSelect.value;
                if (!selectedId) return;

                if (window.__TIXALL_HANDLE_SAVED_LAYOUT_SELECT__) {
                  try {
                    window.__TIXALL_HANDLE_SAVED_LAYOUT_SELECT__(selectedId);
                  } catch (e) {
                    console.error("Error handling saved layout selection", e);
                  }
                } else {
                  console.info(
                    "Saved layout selected (",
                    selectedId,
                    ") – implement __TIXALL_HANDLE_SAVED_LAYOUT_SELECT__ in seating-builder.js to load it."
                  );
                }
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

        // ------------------------------
        // Fly-out behaviour
        // ------------------------------
                // ------------------------------
        // Fly-out behaviour
        // ------------------------------
        var groups = Array.prototype.slice.call(
          document.querySelectorAll(".tool-group")
        );

        function closeAllGroups() {
          groups.forEach(function (g) {
            g.classList.remove("is-open");
          });
        }

        groups.forEach(function (group) {
          var toggle = group.querySelector(".tool-flyout-toggle");
          var flyout = group.querySelector(".tool-flyout");
          var rootBtn = group.querySelector(".tool-root");

          if (toggle && flyout) {
            toggle.addEventListener("click", function (ev) {
              ev.stopPropagation();
              var isOpen = group.classList.contains("is-open");
              closeAllGroups();
              if (!isOpen) {
                group.classList.add("is-open");
              }
            });

                        flyout.addEventListener("click", function (ev) {
              var target = ev.target;
              if (!target || !(target instanceof HTMLElement)) return;

              var optionBtn = target.closest(
                ".tb-left-item.tool-button[data-tool]"
              );
              if (!optionBtn) return;

              var toolName = optionBtn.getAttribute("data-tool") || "";

              // Update root button label + icons + data-tool so it reflects the chosen variant
              if (rootBtn) {
                var newLabelNode = optionBtn.querySelector(".tb-left-label");
                var rootLabelNode = rootBtn.querySelector(".tb-left-label");
                if (newLabelNode && rootLabelNode) {
                  rootLabelNode.textContent = newLabelNode.textContent || "";
                }

                var newDark = optionBtn.querySelector("img.icon-dark");
                var newBlue = optionBtn.querySelector("img.icon-blue");
                var rootDark = rootBtn.querySelector("img.icon-dark");
                var rootBlue = rootBtn.querySelector("img.icon-blue");

                if (rootDark && newDark) {
                  rootDark.src = newDark.src;
                  rootDark.alt = newDark.alt;
                }
                if (rootBlue && newBlue) {
                  rootBlue.src = newBlue.src;
                  rootBlue.alt = newBlue.alt;
                }

                if (toolName) {
                  rootBtn.setAttribute("data-tool", toolName);
                }
              }

              // 🔵 Re-apply active visual state now that the root's data-tool has changed
              if (window.__TIXALL_UPDATE_TOOL_BUTTON_STATE__) {
                window.__TIXALL_UPDATE_TOOL_BUTTON_STATE__(toolName);
              }

              // Let the normal seating-builder.js listeners handle tool activation
              // then close the panel.
              group.classList.remove("is-open");
            });

          }
        });

        // Close fly-outs when clicking anywhere else
                document.addEventListener("click", function (ev) {
          var target = ev.target;
          if (!target || !(target instanceof HTMLElement)) return;
          if (target.closest(".tool-group")) return;
          closeAllGroups();
        });

        // Expose a helper so seating-builder.js can keep the left-rail
        // buttons visually in sync with the active tool
        window.__TIXALL_UPDATE_TOOL_BUTTON_STATE__ = function (activeToolName) {
          try {
            var buttons = Array.prototype.slice.call(
              document.querySelectorAll(".tb-left-item.tool-button[data-tool]")
            );

            buttons.forEach(function (btn) {
              var tool = btn.getAttribute("data-tool");

              if (tool === activeToolName) {
                btn.classList.add("is-active");
              } else {
                btn.classList.remove("is-active");
              }
            });
          } catch (e) {
            console.error("Failed to update tool button state", e);
          }
        };

      })();
    </script>

    <script src="https://unpkg.com/konva@9.3.3/konva.min.js"></script>
    <script src="/static/seating-builder.js"></script>
  </body>
</html>`;

  res.status(200).send(html);
});

/* -------------------------------------------------------------
   ROUTE: GET /builder/api/holds/:showId
   Get saved weekly report settings for a show
   -------------------------------------------------------------- */
router.get("/builder/api/holds/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    // NOTE: In a real deployment, you would fetch this from your database.
    // For now, we return a standard empty structure to prevent errors.
    // const settings = await prisma.showReportSettings.findUnique({ where: { showId } });
    
    return res.json({ 
      ok: true, 
      reportSettings: null 
    });
  } catch (err) {
    console.error("Error getting hold settings", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/* -------------------------------------------------------------
   ROUTE: POST /builder/api/holds/:showId
   Save weekly report settings
   -------------------------------------------------------------- */
router.post("/builder/api/holds/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const { reportEmail, reportTime, reportDay } = req.body;

    // NOTE: Connect this to your Prisma schema when you are ready to persist data.
    // await prisma.showReportSettings.upsert({ ... })

    console.log(`[Holds] Saving report settings for Show ${showId}:`, { reportEmail, reportTime, reportDay });

    return res.json({ ok: true, message: "Report settings saved" });
  } catch (err) {
    console.error("Error saving hold settings", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
