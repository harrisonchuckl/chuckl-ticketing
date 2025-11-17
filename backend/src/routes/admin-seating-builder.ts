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

   NOTE: we intentionally *avoid* prisma.show.findUnique here to
   sidestep the organiserId migration drift in production. We read
   Show via raw SQL instead.
-------------------------------------------------------------- */
router.get("/builder/api/seatmaps/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const userId = await getUserIdFromRequest(req);

    // Read the Show row via raw SQL so we don't reference organiserId
    const rawShows = await prisma.$queryRaw<
      { id: string; title: string | null; date: Date | null; venueId: string | null }[]
    >`SELECT "id","title","date","venueId" FROM "Show" WHERE "id" = ${showId} LIMIT 1`;

    const showRow = rawShows[0];
    if (!showRow) {
      return res.status(404).json({ error: "Show not found" });
    }

    // Look up the venue (normal Prisma; Venue table doesn't have the drift)
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

    // This show's active seat map(s)
    const seatMapsForShow = await prisma.seatMap.findMany({
      where: { showId },
      orderBy: { createdAt: "desc" },
    });
    const activeSeatMap = seatMapsForShow.length > 0 ? seatMapsForShow[0] : null;

    // Previous layouts + templates at this venue (for the right-hand list)
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
   ROUTE: POST save seat map (wizard OR full Konva canvas)
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
      await prisma.$queryRaw<
        { id: string; venueId: string | null }[]
      >`SELECT "id","venueId" FROM "Show" WHERE "id" = ${showId} LIMIT 1`
    )[0];

    if (!showRow) {
      return res.status(404).json({ error: "Show not found" });
    }

    const userId = await getUserIdFromRequest(req);

    const finalName =
      name ||
      (showRow.venueId ? "Room layout" : "Room") +
        (layoutType ? ` – ${layoutType}` : " – Layout");

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
   (this loads the Konva editor; wizard is still available)

   NOTE: preview route no longer touches Prisma at all; it just
   bootstraps the shell and lets seating-builder.js call the API.
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
        <aside class="tb-rail-left">
          <div class="tb-rail-group">
            <div class="tb-rail-label">Tools</div>
            <button class="tb-rail-icon-btn" data-tool="select" title="Select / Move">
              <div class="tb-rail-icon tb-icon-select"></div>
            </button>
            <button class="tb-rail-icon-btn" data-tool="pan" title="Pan canvas">
              <div class="tb-rail-icon tb-icon-hand"></div>
            </button>
            <button class="tb-rail-icon-btn" data-tool="grid" title="Toggle grid">
              <div class="tb-rail-icon tb-icon-grid"></div>
            </button>
          </div>
          <div class="tb-rail-group tb-rail-group-bottom">
            <div class="tb-rail-label">Zoom</div>
            <button class="tb-rail-icon-btn" data-zoom="in" title="Zoom in">+</button>
            <button class="tb-rail-icon-btn" data-zoom="out" title="Zoom out">−</button>
          </div>
        </aside>

        <section class="tb-center">
          <div class="tb-tabs">
            <button class="tb-tab is-active" data-tab="map">Map</button>
            <button class="tb-tab" data-tab="tiers">Tiers</button>
            <button class="tb-tab" data-tab="holds">Holds</button>
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
                <dd id="tb-meta-show-title">Loading…</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd id="tb-meta-venue-name">–</dd>
              </div>
              <div>
                <dt>Estimated capacity</dt>
                <dd id="tb-meta-capacity">Flexible</dd>
              </div>
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
        window.__SEATMAP_SHOW_ID__ = showId;
        window.__SEATMAP_LAYOUT__ = layout;
        window.__TICKIN_SAVE_BUTTON__ = document.getElementById("tb-btn-save");
        window.__TICKIN_BACK_BUTTON__ = document.getElementById("tb-btn-back");

        // Tab switching
        var tabs = document.querySelectorAll(".tb-tab");
        var panels = {
          map: document.getElementById("tb-tab-map"),
          tiers: document.getElementById("tb-tab-tiers"),
          holds: document.getElementById("tb-tab-holds")
        };

        tabs.forEach(function (tab) {
          tab.addEventListener("click", function () {
            var target = tab.getAttribute("data-tab");
            if (!target || !panels[target]) return;

            tabs.forEach(function (t) { t.classList.remove("is-active"); });
            Object.keys(panels).forEach(function (key) {
              panels[key].classList.remove("is-active");
            });

            tab.classList.add("is-active");
            panels[target].classList.add("is-active");
          });
        });

        // Fetch show + venue details to populate top bar + side panel
        fetch("/admin/seating/builder/api/seatmaps/" + encodeURIComponent(showId))
          .then(function (res) { return res.ok ? res.json() : null; })
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

            // Basic population of saved layouts list (read-only for now)
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

        // Basic back button for now: go back in history
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
