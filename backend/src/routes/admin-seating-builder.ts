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
router.get("/builder/preview/:showId", (req, res) => {
  const showId = req.params.showId;
  const layout = normaliseLayout(req.query.layout as string | undefined);

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TickIn Seat Designer</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="stylesheet" href="/static/seating-builder.css" />
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__SEATMAP_SHOW_ID__ = ${JSON.stringify(showId)};
      window.__SEATMAP_LAYOUT__ = ${JSON.stringify(layout)};
    </script>
    <!-- Konva via CDN -->
    <script src="https://unpkg.com/konva@9/konva.min.js"></script>
    <!-- Your seating builder logic -->
    <script src="/static/seating-builder.js"></script>
  </body>
</html>
`;

  res.status(200).send(html);
});

export default router;
