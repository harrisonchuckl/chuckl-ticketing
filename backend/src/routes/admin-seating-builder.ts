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
// FIND THE ENTIRE PREVIEW ROUTE BLOCK
// It starts around line 20138 in your file
router.get("/builder/preview/:showId", (req, res) => {
  const showId = req.params.showId;
  const layout = normaliseLayout(req.query.layout as string | undefined);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TIXALL Seat Designer</title>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="/static/seating-builder.css" />
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
      margin: 0;
      height: 100vh;
      overflow: hidden;
    }
    .tb-topbar-btn.tb-btn-primary {
      border-radius: 999px; border: 0; background: linear-gradient(135deg, var(--tixall-blue), #08c8f8);
      color: #ffffff; font-weight: 600; box-shadow: none;
    }
    .tb-topbar-btn.tb-btn-ghost {
      border-radius: 999px; border: 1px solid var(--tixall-border-subtle); background: #ffffff; color: var(--tixall-dark);
    }
    .tb-logo-badge { background: #071018; border-radius: 999px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; }
    .tb-logo-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--tixall-blue); }
    .tb-logo-text { font-weight: 600; font-size: 13px; color: #ffffff; }
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
            <span id="tb-show-venue">Loading...</span>
            <span class="tb-dot">·</span>
            <span id="tb-show-date"></span>
          </div>
        </div>
      </div>
      <div class="tb-topbar-right">
        <button type="button" class="tb-topbar-btn tb-btn-ghost" id="tb-btn-delete" style="display: none;" disabled>Delete layout</button>
        <select id="tb-saved-layout-select" class="tb-topbar-select" aria-label="Saved layouts">
          <option value="" disabled selected>Loading...</option>
        </select>
        <button type="button" class="tb-topbar-btn tb-btn-ghost" id="tb-btn-back">Back</button>
        <button type="button" class="tb-topbar-btn tb-btn-ghost" id="tb-btn-load">Load</button>
        <button type="button" class="tb-topbar-btn tb-btn-primary" id="tb-btn-save">Save</button>
      </div>
    </header>

    <main class="tickin-builder-main sb-admin-main">
      <aside class="tb-left-rail sb-elements-panel" aria-label="Seating tools">
        <div class="tb-left-scroll">
          <div class="tb-left-group">
             <div class="tool-group" data-group="line-section">
               <button class="tb-left-item tool-button tool-root" data-tool="line">
                 <img class="tb-tool-icon icon-dark" src="/seatmap-icons/line-black.png" alt="Line" />
                 <img class="tb-tool-icon icon-blue" src="/seatmap-icons/line-blue.png" style="display:none" alt="Line" />
                 <span class="tb-left-label">Line / shapes</span>
               </button>
               <button class="tool-flyout-toggle" type="button"> <span class="tool-flyout-chevron"> ▸ </span> </button>
               <div class="tool-flyout">
                 <button class="tb-left-item tool-button" data-tool="line"><span class="tb-left-label">Line</span></button>
                 <button class="tb-left-item tool-button" data-tool="curve-line"><span class="tb-left-label">Curve</span></button>
                 <button class="tb-left-item tool-button" data-tool="arc"><span class="tb-left-label">Arc</span></button>
                 <button class="tb-left-item tool-button" data-tool="arrow"><span class="tb-left-label">Arrow</span></button>
                 <button class="tb-left-item tool-button" data-tool="stairs"><span class="tb-left-label">Stairs</span></button>
                 <button class="tb-left-item tool-button" data-tool="section"><span class="tb-left-label">Section</span></button>
                 <button class="tb-left-item tool-button" data-tool="square"><span class="tb-left-label">Square</span></button>
                 <button class="tb-left-item tool-button" data-tool="circle"><span class="tb-left-label">Circle</span></button>
                 <button class="tb-left-item tool-button" data-tool="multi"><span class="tb-left-label">Multi</span></button>
               </div>
             </div>
          </div>
          
          <div class="tb-left-group">
             <div class="tool-group" data-group="rows-single">
                <button class="tb-left-item tool-button tool-root" data-tool="row">
                  <img class="tb-tool-icon icon-dark" src="/seatmap-icons/row-black.png" alt="Rows" />
                  <img class="tb-tool-icon icon-blue" src="/seatmap-icons/row-blue.png" style="display:none" alt="Rows" />
                  <span class="tb-left-label">Rows</span>
                </button>
                <button class="tool-flyout-toggle" type="button"> <span class="tool-flyout-chevron"> ▸ </span> </button>
                <div class="tool-flyout">
                   <button class="tb-left-item tool-button" data-tool="row"><span class="tb-left-label">Rows</span></button>
                   <button class="tb-left-item tool-button" data-tool="single"><span class="tb-left-label">Single Seat</span></button>
                </div>
             </div>
          </div>

          <div class="tb-left-group">
             <div class="tool-group" data-group="tables">
                <button class="tb-left-item tool-button tool-root" data-tool="circle-table">
                  <img class="tb-tool-icon icon-dark" src="/seatmap-icons/circle-table-black.png" alt="Tables" />
                  <img class="tb-tool-icon icon-blue" src="/seatmap-icons/circle-table-blue.png" style="display:none" alt="Tables" />
                  <span class="tb-left-label">Tables</span>
                </button>
                <button class="tool-flyout-toggle" type="button"> <span class="tool-flyout-chevron"> ▸ </span> </button>
                <div class="tool-flyout">
                   <button class="tb-left-item tool-button" data-tool="circle-table"><span class="tb-left-label">Round Table</span></button>
                   <button class="tb-left-item tool-button" data-tool="rect-table"><span class="tb-left-label">Rect Table</span></button>
                </div>
             </div>
          </div>

          <div class="tb-left-group">
             <div class="tool-group" data-group="objects">
                <button class="tb-left-item tool-button tool-root" data-tool="stage">
                  <img class="tb-tool-icon icon-dark" src="/seatmap-icons/stage-dark.png" alt="Objects" />
                  <img class="tb-tool-icon icon-blue" src="/seatmap-icons/stage-blue.png" style="display:none" alt="Objects" />
                  <span class="tb-left-label">Objects</span>
                </button>
                <button class="tool-flyout-toggle" type="button"> <span class="tool-flyout-chevron"> ▸ </span> </button>
                <div class="tool-flyout">
                   <button class="tb-left-item tool-button" data-tool="stage"><span class="tb-left-label">Stage</span></button>
                   <button class="tb-left-item tool-button" data-tool="bar"><span class="tb-left-label">Bar</span></button>
                   <button class="tb-left-item tool-button" data-tool="exit"><span class="tb-left-label">Exit</span></button>
                   <button class="tb-left-item tool-button" data-tool="text"><span class="tb-left-label">Text</span></button>
                </div>
             </div>
          </div>
          
           <div class="tb-left-group">
             <div class="tool-group" data-group="symbols">
                <button class="tb-left-item tool-button tool-root" data-tool="symbol-wc-mixed">
                  <img class="tb-tool-icon icon-dark" src="/seatmap-icons/mixedtoilets-dark.png" alt="Symbols" />
                  <img class="tb-tool-icon icon-blue" src="/seatmap-icons/mixedtoilets-blue.png" style="display:none" alt="Symbols" />
                  <span class="tb-left-label">Symbols</span>
                </button>
                <button class="tool-flyout-toggle" type="button"> <span class="tool-flyout-chevron"> ▸ </span> </button>
                <div class="tool-flyout">
                   <button class="tb-left-item tool-button" data-tool="symbol-wc-mixed"><span class="tb-left-label">WC</span></button>
                   <button class="tb-left-item tool-button" data-tool="symbol-info"><span class="tb-left-label">Info</span></button>
                </div>
             </div>
          </div>

          <div class="tb-left-group tb-left-group-actions">
             <button class="tb-left-item" id="sb-undo"><span class="tb-left-label">Undo</span></button>
             <button class="tb-left-item" id="sb-redo"><span class="tb-left-label">Redo</span></button>
             <button class="tb-left-item tb-left-item-danger" id="sb-clear"><span class="tb-left-label">Clear</span></button>
          </div>
        </div>
      </aside>

      <section class="tb-center">
        <div class="tb-center-header">
          <div class="tb-tabs">
            <button class="tb-tab is-active" data-tab="map">Map</button>
            <button class="tb-tab" data-tab="tickets">Tickets</button>
            <button class="tb-tab" data-tab="holds">Holds</button>
            <button class="tb-tab" data-tab="view">View</button>
          </div>
          <div class="tb-zoom-toolbar">
            <button class="tb-zoom-btn" id="sb-zoom-out">−</button>
            <button class="tb-zoom-btn tb-zoom-label" id="sb-zoom-reset">100%</button>
            <button class="tb-zoom-btn" id="sb-zoom-in">+</button>
          </div>
        </div>
        <div class="tb-tab-panels">
          <div class="tb-tab-panel is-active" id="tb-tab-map">
            <div class="sb-seatmap-wrapper">
              <div id="app"></div>
            </div>
          </div>
          <div class="tb-tab-panel" id="tb-tab-tickets"><div class="tb-empty-panel"></div></div>
          <div class="tb-tab-panel" id="tb-tab-holds"><div class="tb-empty-panel"><h2>Holds</h2></div></div>
          <div class="tb-tab-panel" id="tb-tab-view"><div class="tb-empty-panel"><h2>View</h2></div></div>
        </div>
      </section>

      <aside class="tb-side-panel sb-side-panel">
        <section class="tb-side-section">
          <h3 class="tb-side-heading">Seats on map</h3>
          <div class="tb-side-meta">
             <div><dt>Total seats</dt><dd id="sb-seat-count">0 seats</dd></div>
          </div>
        </section>
        <section class="tb-side-section">
          <h3 class="tb-side-heading">Selection</h3>
          <div id="sb-inspector" class="tb-inspector">
            <p class="sb-inspector-empty">Select an object to edit.</p>
          </div>
        </section>
      </aside>
    </main>
  </div>

  <script>
    (function () {
       var showId = ${JSON.stringify(showId)};
       var layout = ${JSON.stringify(layout)};
       window.__SEATMAP_SHOW_ID__ = showId;
       window.__SEATMAP_LAYOUT__ = layout;
       window.__TICKIN_SAVE_BUTTON__ = document.getElementById("tb-btn-save");
       window.__TICKIN_BACK_BUTTON__ = document.getElementById("tb-btn-back");
       window.__TICKIN_LOAD_BUTTON__ = document.getElementById("tb-btn-load");
       window.__TICKIN_DELETE_BUTTON__ = document.getElementById("tb-btn-delete");
    })();
  </script>
  <script src="https://unpkg.com/konva@9.3.3/konva.min.js"></script>
  <script src="/static/seating-builder.js"></script>
</body>
</html>`;

  res.status(200).send(html);
});

export default router;
