import { Router } from "express";
import { Prisma, PrismaClient, ShowStatus } from "@prisma/client";
import { verifyJwt } from "../utils/security.js";

const prisma = new PrismaClient();
const router = Router();

function isMissingColumnError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  // Debug logging so we can see what's REALLY happening in Railway logs
  console.error("[seatmap] Prisma error in show update", {
    code: err.code,
    message: err.message,
    meta: (err as any).meta,
  });

  if (err.code !== "P2021" && err.code !== "P2022") {
    return false;
  }

  const msg = (err.message || "").toLowerCase();
  const metaStr = JSON.stringify((err as any).meta ?? {}).toLowerCase();
  const text = msg + " " + metaStr;

  const mentionsShowTable =
    text.includes('"show"') || text.includes("show");

  const mentionsPublishingColumns =
    text.includes("status") || text.includes("publishedat");

  // Only treat it as "publishing columns missing" if it clearly mentions our
  // Show table AND the status/publishedAt fields.
  return mentionsShowTable && mentionsPublishingColumns;
}

let ensureShowPublishingSchemaPromise: Promise<void> | null = null;

async function ensureShowPublishingSchema(): Promise<void> {
  if (!ensureShowPublishingSchemaPromise) {
    ensureShowPublishingSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          CREATE TYPE "ShowStatus" AS ENUM ('DRAFT', 'LIVE');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Show"
        ADD COLUMN IF NOT EXISTS "status" "ShowStatus" NOT NULL DEFAULT 'DRAFT';
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Show"
        ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
      `);

      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          ALTER TABLE "Show" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
        EXCEPTION
          WHEN undefined_column THEN NULL;
        END $$;
      `);
    })();

  }

  return ensureShowPublishingSchemaPromise;
}

function respondWithKnownPrismaError(res: any, err: any) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    return res.status(404).json({
      error: "not_found",
      message: "Seat map was not found for this show.",
    });
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2003"
  ) {
    return res.status(400).json({
      error: "invalid_reference",
      message: "Seat map save failed because the related show or venue is missing.",
    });
  }

  return null;
}


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
// --- GET: Load Editor ---
router.get("/builder/api/seatmaps/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const userId = await getUserIdFromRequest(req);

    // Fetch show AND the new activeSeatMapId field
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { venue: true }
    });

    if (!show) return res.status(404).json({ error: "Show not found" });

    // Fetch all maps for this show
    const seatMapsForShow = await prisma.seatMap.findMany({
      where: { showId },
      orderBy: { createdAt: "desc" },
    });

    // --- LOGIC UPDATE: Determine Active Map ---
    let activeSeatMap = null;
    
    // 1. Try the one explicitly linked as 'activeSeatMapId'
    // @ts-ignore (Field exists in DB after migration)
    if (show.activeSeatMapId) {
        // @ts-ignore
        activeSeatMap = seatMapsForShow.find(m => m.id === show.activeSeatMapId);
    }
    
    // 2. Fallback to the most recent one (if no link exists yet)
    if (!activeSeatMap && seatMapsForShow.length > 0) {
        activeSeatMap = seatMapsForShow[0];
    }

    // Previous maps (excluding the active one)
    const previousMaps = seatMapsForShow.filter(m => m.id !== (activeSeatMap?.id));

    // Fetch templates (unchanged)
    let templates: any[] = [];
    if (show.venueId) {
        const templateWhere: any = { venueId: show.venueId, isTemplate: true };
        if (userId) templateWhere.createdByUserId = userId;
        
        templates = await prisma.seatMap.findMany({
            where: templateWhere,
            orderBy: { createdAt: "desc" },
            select: {
                id: true, name: true, createdAt: true, version: true,
                layout: true, isTemplate: true, isDefault: true,
            },
        });
    }

    return res.json({
      show: {
        id: show.id,
        title: show.title,
        date: show.date,
        venue: show.venue ? {
          id: show.venue.id,
          name: show.venue.name,
          city: show.venue.city,
          capacity: show.venue.capacity,
          bookingFeeBps: (show.venue as any).bookingFeeBps ?? null,
        } : null,
      },
      activeSeatMap: activeSeatMap ? {
        id: activeSeatMap.id,
        name: activeSeatMap.name,
        layout: activeSeatMap.layout,
        isTemplate: activeSeatMap.isTemplate,
        isDefault: activeSeatMap.isDefault,
        version: activeSeatMap.version,
      } : null,
      previousMaps: previousMaps.map(m => ({
        id: m.id,
        name: m.name,
        createdAt: m.createdAt,
        version: m.version
      })),
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
// --- POST: Save Map ---
router.post("/builder/api/seatmaps/:showId", async (req, res) => {
  try {
    const showId = req.params.showId;
    const {
      seatMapId, saveAsTemplate, name, layoutType, config,
      estimatedCapacity, konvaJson, showStatus, completionStatus, tickets, bookingFeeBps,
    } = req.body ?? {};

    const showRow = await prisma.show.findUnique({ where: { id: showId } });
    if (!showRow) return res.status(404).json({ error: "Show not found" });

    // Ensure schema (safety check)
    try { await ensureShowPublishingSchema(); } catch (e) { /* ignore */ }

    const userId = await getUserIdFromRequest(req);
    const finalName = name || "Seating Map";

    const layoutPayload = {
      layoutType: layoutType ?? null,
      config: config ?? null,
      estimatedCapacity: estimatedCapacity ?? null,
      konvaJson: konvaJson ?? null,
      meta: {
        showId,
        venueId: showRow.venueId ?? null,
        savedAt: new Date().toISOString(),
        completionStatus: completionStatus ?? null,
      },
    };

    let saved;
    let existingSeatMap: { id: string } | null = null;
    let nextBookingFeeBps: number | null = null;

    if (bookingFeeBps !== undefined && bookingFeeBps !== null) {
      const parsed = Number(bookingFeeBps);
      if (Number.isFinite(parsed)) {
        nextBookingFeeBps = Math.max(1000, Math.round(parsed));
      }
    }

    if (seatMapId) {
        // Look for map by ID
        const scope: any[] = [{ showId }];
        if (showRow.venueId) scope.push({ venueId: showRow.venueId });
        
        existingSeatMap = await prisma.seatMap.findFirst({
            where: { id: seatMapId, OR: scope },
            select: { id: true },
        });
    }

    if (existingSeatMap) {
      // Update existing
      saved = await prisma.seatMap.update({
        where: { id: existingSeatMap.id },
        data: {
          name: finalName,
          layout: layoutPayload as any,
          isTemplate: !!saveAsTemplate,
          updatedAt: new Date(),
          version: { increment: 1 },
        },
      });
    } else {
      // Create new
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

    // --- CRITICAL UPDATE: Link this specific map as the ACTIVE map for the show ---
    await prisma.show.update({
        where: { id: showId },
        data: { 
            // @ts-ignore
            activeSeatMapId: saved.id,
            status: showStatus === "LIVE" ? "LIVE" : undefined
        }
    });

    if (nextBookingFeeBps !== null && showRow.venueId) {
      await prisma.venue.update({
        where: { id: showRow.venueId },
        data: { bookingFeeBps: nextBookingFeeBps },
      });
    }

    // --- Sync Ticket Types ---
    if (Array.isArray(tickets)) {
      await prisma.ticketType.deleteMany({ where: { showId } });
      for (const t of tickets) {
        if (!t.name) continue;
        const pricePence = Math.round(Number(t.price || 0) * 100);
        await prisma.ticketType.create({
          data: {
            showId, name: t.name, pricePence, available: null,
          },
        });
      }
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
    if (isMissingColumnError(err)) {
      return res.status(400).json({ error: "schema_mismatch", message: "Database schema out of sync." });
    }
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
        /* BRANDING */
        --tixall-blue: #08B8E8;
        --tixall-blue-hover: #069ac4;
        --tixall-dark: #182828;
        
        /* UI SURFACES */
        --bg-app: #F8FAFC;
        --bg-panel: #FFFFFF;
        --border-color: #E2E8F0;
        --text-main: #334155;
        --text-light: #64748b;
        --tixall-grey-soft: #F4F5F7;
        
        /* STATUS */
        --status-success: #10B981;
    }

    body.tickin-builder-body {
        margin: 0;
        height: 100vh;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: var(--text-main);
        background: var(--bg-app);
        -webkit-font-smoothing: antialiased;
    }

    .tickin-builder-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
    }

    /* --- TOP HEADER (New Style) --- */
    .tickin-builder-topbar {
        height: 64px;
        flex-shrink: 0;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 24px;
        z-index: 20;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .tb-logo-badge {
        background: var(--tixall-dark); color: #fff;
        padding: 6px 12px; border-radius: 99px; font-weight: 700; font-size: 13px;
        display: flex; gap: 8px; align-items: center;
    }
    .tb-logo-dot { width: 8px; height: 8px; background: var(--tixall-blue); border-radius: 50%; }
    .tb-show-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .tb-show-subtitle { font-size: 13px; color: #64748b; margin-left: 12px; }

    .tb-topbar-btn {
        height: 36px; padding: 0 16px; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        transition: all 0.2s;
    }
    .tb-btn-ghost { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); }
    .tb-btn-ghost:hover { background: #f1f5f9; }
    
    .tb-btn-draft { background: #fff; border: 1px solid var(--border-color); color: var(--text-main); margin-right: 8px; }
    .tb-btn-draft:hover { background: #f8fafc; border-color: #cbd5e1; }

    .tb-btn-publish { background: var(--status-success); border: 1px solid var(--status-success); color: #fff; }
    .tb-btn-publish:hover:not(:disabled) { background: #059669; }
    .tb-btn-publish:disabled { background: #e2e8f0; border-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
    
    .tb-topbar-select { height: 36px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 13px; }

    /* --- MAIN LAYOUT (Restored Grid to support Left Panel) --- */
    .tickin-builder-main {
        display: grid;
        grid-template-columns: auto 1fr auto; /* Auto width for left rail */
        flex: 1;
        overflow: hidden;
        min-height: 0;
    }

    /* --- LEFT RAIL (RESTORED TO ORIGINAL) --- */
    .tb-left-rail {
        background: linear-gradient(180deg, #f7fafc, #f2f5f9);
        border-right: 1px solid var(--border-color);
        overflow: visible;
        padding-inline: 4px;
        display: block;
        width: auto;
    }
    .tb-left-scroll { padding: 18px 14px 20px; overflow: visible; }
    .tb-left-group { margin-bottom: 10px; }
    
    .tb-left-group-label {
        font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
        color: #7a828f; margin: 0 0 8px; text-align: center;
    }

    /* Original Tool Button Style (Big Icon Top, Text Bottom) */
    .tb-left-item.tool-button {
        flex-direction: column;
        align-items: center; justify-content: flex-start; text-align: center;
        padding: 12px 4px 10px; gap: 6px;
        border-radius: 18px;
        background: transparent !important; border: 0 !important; box-shadow: none !important;
        min-height: 72px; width: 100%;
        cursor: pointer;
        color: var(--text-main);
    }
    /* Hover/Active States */
    .tb-left-item.tool-button:hover { background: transparent !important; opacity: 0.8; }
    .tb-left-item.tool-button img.tb-tool-icon { width: 44px; height: 44px; display: block; flex-shrink: 0; object-fit: contain; }

    /* Icon Swapping Logic */
    .tb-left-item.tool-button img.icon-dark { display: block; }
    .tb-left-item.tool-button img.icon-blue { display: none; }
    .tb-left-item.tool-button.is-active img.icon-dark { display: none; }
    .tb-left-item.tool-button.is-active img.icon-blue { display: block; }

    .tb-left-item.tool-button .tb-left-label {
        display: block; font-size: 11px; line-height: 1.2; font-weight: 500;
        color: var(--text-main); white-space: normal; text-align: center;
        max-width: 80px; word-break: break-word;
    }

    /* Flyouts (Original Positioning) */
    .tool-group { position: relative; margin-bottom: 6px; display: block; }
    .tool-group .tool-root { width: 100%; min-height: 72px; }
    .tool-flyout-toggle {
        border: 0; background: transparent; padding: 0; cursor: pointer; color: #7a828f;
        position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
        width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
    }
    .tool-flyout-toggle:hover { background: rgba(8, 184, 232, 0.06); color: var(--text-main); }
    .tool-flyout {
        position: absolute; left: 100%; top: 0; display: none;
        flex-direction: column; gap: 4px; padding: 6px;
        background: #ffffff; border-radius: 12px;
        box-shadow: 0 12px 32px rgba(15,23,42,0.20); border: 1px solid rgba(148,163,184,0.35);
        z-index: 9999; min-width: 170px;
    }
    .tool-group.is-open .tool-flyout { display: flex; }
    
    /* List items inside flyout (Horizontal layout) */
    .tool-flyout .tb-left-item.tool-button {
        min-height: 0; padding: 8px 10px; flex-direction: row;
        justify-content: flex-start; text-align: left; border-radius: 12px; gap: 8px;
    }
    .tool-flyout .tb-left-item.tool-button img.tb-tool-icon { width: 24px; height: 24px; }
    .tool-flyout .tb-left-item.tool-button .tb-left-label { max-width: none; white-space: nowrap; }

    /* Action Buttons (Undo/Redo) */
    .tb-left-item {
        border: 0; background: transparent; border-radius: 999px; padding: 8px 10px;
        display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
        cursor: pointer; font-size: 12px; color: var(--text-main); transition: background 0.15s ease;
    }
    .tb-left-item:hover { background: rgba(8, 184, 232, 0.06); }
    .tb-left-icon {
        width: 26px; height: 26px; border-radius: 999px; background: var(--tixall-grey-soft);
        display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .tb-left-item.tb-left-item-danger { color: #b3261e; }
    .tb-left-item.tb-left-item-danger .tb-left-icon { background: #ffeceb; }


    /* --- CENTER CANVAS (Floating Tabs) --- */
    .tb-center {
        display: flex; flex-direction: column; min-height: 0; position: relative;
        background: var(--bg-app);
    }
    .tb-center-header {
  position: absolute; 
  top: 24px; 
  left: 0; 
  right: 0;
  height: 40px; 
  display: flex; 
  justify-content: center; 
  align-items: center;
  pointer-events: none; 
  z-index: 50;
  
  /* --- FIX: Remove the background strip --- */
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
    .tb-tabs {
        pointer-events: auto; background: #ffffff; padding: 5px; border-radius: 99px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); display: flex; gap: 4px;
        border: 1px solid var(--border-color);
    }
    .tb-tab {
        padding: 8px 24px; border-radius: 99px; border: none; background: transparent;
        font-size: 13px; font-weight: 600; color: var(--text-light); cursor: pointer; transition: all 0.2s;
    }
    .tb-tab:hover { color: var(--tixall-dark); background: #f8fafc; }

    /* ACTIVE TAB = TIXALL BLUE BACKGROUND */
    .tb-tab.is-active {
        background: var(--tixall-blue); color: #ffffff;
        box-shadow: 0 2px 4px rgba(8, 184, 232, 0.25);
    }
    
    /* Completed Tabs */
    .tb-tab.is-complete::after { content: ' ✓'; font-size: 11px; margin-left: 6px; color: var(--status-success); font-weight: 800; }
    .tb-tab.is-active.is-complete::after { color: #fff; }

    /* Zoom Controls */
.tb-zoom-toolbar {
  position: absolute;
  top: auto !important;    /* Force unset the top position */
  bottom: 24px !important; /* Force set the bottom position */
  right: 24px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  display: flex;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  z-index: 50;
  pointer-events: auto;
}

.tb-zoom-btn { width: 32px; height: 32px; border: none; background: #fff; cursor: pointer; color: var(--text-main); }
    .tb-zoom-btn:hover { background: #f8fafc; }
    .tb-zoom-label { width: 44px; font-size: 12px; font-weight: 600; border-left: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; }

.tb-tab-panels {
  flex: 1;
  position: relative;
  overflow: hidden; /* This clips the map to the canvas area only */
  border-radius: 12px; /* Optional: adds nice rounded corners to the map view */
  margin: 12px; /* Optional: adds a small gap so it doesn't touch the edges */
  border: 1px solid var(--border-color); /* Optional: distinct border for the map area */
  background: #fff; /* Ensures grid doesn't show through transparent areas */
}
    .tb-tab-panel { display: none; width: 100%; height: 100%; }
    .tb-tab-panel.is-active { display: block; }
    #app { width: 100%; height: 100%; }
    #app > div { z-index: 1 !important; }

    /* --- RIGHT PANEL (New Clean Style) --- */
    .tb-side-panel {
        background: var(--bg-panel);
        border-left: 1px solid var(--border-color);
        width: 360px; min-width: 360px;
        padding: 24px; overflow-y: auto;
        z-index: 15;
    }
    .tb-side-section { margin-bottom: 12px; }
    .tb-side-heading {
        font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
        color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;
    }

    /* Interaction Fixes */
    .tb-empty-panel { pointer-events: none !important; }
    #tb-tab-tickets, #tb-tab-holds, #tb-tab-view { pointer-events: none !important; }
    #tb-tab-map { pointer-events: auto !important; }
    
    /* Next Step Button */
    .sb-next-step-btn {
        width: 100%; margin-top: 24px; padding: 12px;
        background: var(--tixall-blue); color: white; border: none; border-radius: 8px;
        font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
        cursor: pointer; box-shadow: 0 4px 6px -1px rgba(8, 184, 232, 0.2); transition: all 0.2s;
    }
    .sb-next-step-btn:hover { background: var(--tixall-blue-hover); transform: translateY(-1px); }
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
    <button class="tb-tab is-active" data-tab="map">1. Map</button>
    <button class="tb-tab" data-tab="tickets">2. Tickets</button>
    <button class="tb-tab" data-tab="holds">3. Holds & External Allocations</button>
    <button class="tb-tab" data-tab="view">4. Seating Information and View from Seats</button>
  </div>
</div>

<div class="tb-zoom-toolbar" aria-label="Zoom">
  <button class="tb-zoom-btn" id="sb-zoom-out">−</button>
  <button class="tb-zoom-btn tb-zoom-label" id="sb-zoom-reset">100%</button>
  <button class="tb-zoom-btn" id="sb-zoom-in">+</button>
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
        // [Source: 10430] - Updated Tab Switch Logic
tabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    var target = tab.getAttribute("data-tab");
    if (!target || !panels[target]) return;

    // --- NEW: First-time Guardrail Warning ---
    // If moving AWAY from map for the first time, show warning
    if (target !== "map") {
      // @ts-ignore
      if (!window.__TIXALL_HAS_SEEN_LOCK_WARNING__) {
        var msg = "Once tickets, holds or information have been assigned to seats, " +
                  "you can no longer change the configuration of any rows of seats or tables " +
                  "without first unallocating the items added.";
        
        if (!confirm(msg)) {
          return; // User cancelled, stay on Map tab
        }
        // @ts-ignore
        window.__TIXALL_HAS_SEEN_LOCK_WARNING__ = true;
      }
    }
    // -----------------------------------------

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
