// backend/src/routes/admin-seating-builder.ts
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
   (Used by the builder's loader on page open)
-------------------------------------------------------------- */
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
      const base = { venueId };
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

/* -------------------------------------------------------------
   ROUTE: POST save seat map (wizard OR full Konva canvas)
   Body:
   {
      seatMapId?: string;
      name?: string;
      saveAsTemplate?: boolean;

      // Wizard (optional)
      layoutType?: "tables" | "sections" | "mixed" | "blank";
      config?: { ... };
      estimatedCapacity?: number;

      // Konva JSON (optional)
      konvaJson?: object;
   }
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
      (show.venue?.name ?? "Room") +
        (layoutType ? ` – ${layoutType}` : " – Layout");

    /**
     * Unified layout payload:
     * Stores BOTH wizard config AND full Konva JSON.
     * This means templates are compatible with both systems.
     */
    const layoutPayload = {
      layoutType: layoutType ?? null,
      config: config ?? null,
      estimatedCapacity: estimatedCapacity ?? null,
      konvaJson: konvaJson ?? null,
      meta: {
        showId,
        venueId: show.venueId ?? null,
        savedAt: new Date().toISOString(),
      },
    };

    let saved;

    if (seatMapId) {
      // update
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
      // create
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

/* -------------------------------------------------------------
   ROUTE: GET builder full-page HTML
   (this loads the Konva editor; wizard is still available)
-------------------------------------------------------------- */
router.get("/builder/preview/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const layout = normaliseLayout(req.query.layout as string | undefined);

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { venue: true },
    });

    const showTitle = show?.title ?? "Seat map designer";
    const venueName = show?.venue?.name ?? "Venue";
    const venueCity = show?.venue?.city ?? "";
    const showDate = show?.date
      ? new Date(show.date).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

    const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TickIn Seat Designer – ${showTitle}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="stylesheet" href="/static/seating-builder.css" />
  </head>
  <body class="tickin-builder-body">
    <div class="tickin-builder-shell">
      <!-- Top bar -->
      <header class="tickin-builder-topbar">
        <div class="tb-topbar-left">
          <div class="tb-logo-badge">
            <span class="tb-logo-dot"></span>
            <span class="tb-logo-text">TickIn</span>
          </div>
          <div class="tb-show-meta">
            <h1 class="tb-show-title">${showTitle}</h1>
            <div class="tb-show-subtitle">
              <span>${venueName}</span>
              ${venueCity ? `<span class="tb-dot">•</span><span>${venueCity}</span>` : ""}
              ${showDate ? `<span class="tb-dot">•</span><span>${showDate}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="tb-topbar-right">
          <button type="button" class="tb-topbar-btn tb-btn-ghost" id="tb-exit-builder">
            Exit
          </button>
          <button type="button" class="tb-topbar-btn tb-btn-primary" id="tb-save-layout">
            Save layout
          </button>
        </div>
      </header>

      <!-- Main 3-column layout -->
      <div class="tickin-builder-main">
        <!-- Left tools rail (copy / paste / zoom etc. – wired later in JS) -->
        <aside class="tb-rail-left">
          <div class="tb-rail-group">
            <div class="tb-rail-label">Tools</div>
            <button class="tb-rail-icon-btn" data-tool="select" title="Select (V)">
              <span class="tb-rail-icon tb-icon-select"></span>
            </button>
            <button class="tb-rail-icon-btn" data-tool="pan" title="Pan (Space)">
              <span class="tb-rail-icon tb-icon-hand"></span>
            </button>
            <button class="tb-rail-icon-btn" data-tool="grid" title="Toggle grid (G)">
              <span class="tb-rail-icon tb-icon-grid"></span>
            </button>
          </div>

          <div class="tb-rail-group tb-rail-group-bottom">
            <div class="tb-rail-label">Zoom</div>
            <button class="tb-rail-icon-btn" id="tb-zoom-in" title="Zoom in (+)">
              +
            </button>
            <button class="tb-rail-icon-btn" id="tb-zoom-out" title="Zoom out (-)">
              –
            </button>
          </div>
        </aside>

        <!-- Centre: tabs + canvas -->
        <main class="tb-center">
          <!-- Tabs row -->
          <div class="tb-tabs">
            <button class="tb-tab is-active" data-tab="map">Map</button>
            <button class="tb-tab" data-tab="tiers">Tiers</button>
            <button class="tb-tab" data-tab="holds">Holds</button>
          </div>

          <!-- Tab panels -->
          <div class="tb-tab-panels">
            <section class="tb-tab-panel is-active" id="tb-tab-map">
              <!-- Existing Konva builder mounts into #app -->
              <div id="app"></div>
            </section>

            <section class="tb-tab-panel" id="tb-tab-tiers">
              <div class="tb-empty-panel">
                <h2>Tiers (coming soon)</h2>
                <p>
                  Here you’ll assign seats to price tiers and link them directly
                  to your ticket types.
                </p>
              </div>
            </section>

            <section class="tb-tab-panel" id="tb-tab-holds">
              <div class="tb-empty-panel">
                <h2>Holds (coming soon)</h2>
                <p>
                  Use holds to reserve blocks of seats for artists, sponsors, or
                  guest lists without putting them on general sale.
                </p>
              </div>
            </section>
          </div>
        </main>

        <!-- Right side: layout summary / saved maps -->
        <aside class="tb-side-panel">
          <div class="tb-side-section">
            <h2 class="tb-side-heading">Layout details</h2>
            <dl class="tb-side-meta">
              <div>
                <dt>Layout type</dt>
                <dd>${layout}</dd>
              </div>
              <div>
                <dt>Estimated capacity</dt>
                <dd id="tb-estimated-capacity">Flexible</dd>
              </div>
            </dl>
          </div>

          <div class="tb-side-section">
            <h2 class="tb-side-heading">Saved seat maps</h2>
            <p class="tb-side-help">
              You can reuse layouts you’ve already created for this venue.
            </p>
            <div id="tb-saved-layouts" class="tb-saved-list">
              <!-- seating-builder.js will populate this -->
            </div>
          </div>
        </aside>
      </div>
    </div>

    <script>
      window.__SEATMAP_SHOW_ID__ = ${JSON.stringify(showId)};
      window.__SEATMAP_LAYOUT__ = ${JSON.stringify(layout)};

      // Basic tab switching (Map / Tiers / Holds).
      // The actual functionality still lives in seating-builder.js – this is just UI chrome.
      document.addEventListener("DOMContentLoaded", () => {
        const tabButtons = Array.from(document.querySelectorAll(".tb-tab"));
        const panels = {
          map: document.getElementById("tb-tab-map"),
          tiers: document.getElementById("tb-tab-tiers"),
          holds: document.getElementById("tb-tab-holds"),
        };

        tabButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            if (!tab || !panels[tab]) return;

            tabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
            Object.entries(panels).forEach(([key, panel]) => {
              panel.classList.toggle("is-active", key === tab);
            });
          });
        });

        // Exit button: just go back in history for now.
        const exitBtn = document.getElementById("tb-exit-builder");
        if (exitBtn) {
          exitBtn.addEventListener("click", () => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/admin/ui/shows";
            }
          });
        }

        // Save button: seating-builder.js will hook into this via ID.
        const saveBtn = document.getElementById("tb-save-layout");
        if (saveBtn) {
window.__TICKIN_SAVE_BUTTON__ = saveBtn;
        }
      });
    </script>

    <script src="/static/konva.min.js"></script>
    <script src="/static/seating-builder.js"></script>
  </body>
</html>
`;

    res.status(200).send(html);
  } catch (err) {
    console.error("Error in GET /builder/preview/:showId", err);
    res.status(500).send("Internal error");
  }
});

export default router;
