// backend/src/routes/seating-choice.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * Simple shared shell so both pages feel like part of the same flow.
 */
function renderShell(options: {
  title: string;
  body: string;
  stepLabel?: string;
  showId: string;
}) {
  const { title, body, stepLabel, showId } = options;

  const stepText = stepLabel
    ? `<div class="step-pill">${stepLabel}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #f3f6fb;
      --card-bg: #ffffff;
      --card-border: #e1e7f3;
      --card-border-active: #3b82f6;
      --card-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --pill-bg: #e0edff;
      --pill-text: #2563eb;
      --accent: #2563eb;
      --accent-soft: #e0edff;
      --radius-xl: 24px;
      --radius-lg: 20px;
      --radius-pill: 999px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      height: 100%;
    }

    body {
      display: flex;
      min-height: 100vh;
      align-items: stretch;
      justify-content: center;
    }

    .page {
      width: 100%;
      max-width: 1120px;
      margin: 32px auto;
      padding: 0 24px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .page-header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: var(--pill-bg);
      color: var(--pill-text);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .headline {
      font-size: 22px;
      line-height: 1.25;
      letter-spacing: -0.02em;
      font-weight: 650;
    }

    .subhead {
      font-size: 13px;
      color: var(--text-muted);
    }

    .page-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ghost-button {
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.5);
      padding: 7px 14px;
      background: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      color: var(--text-main);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      text-decoration: none;
      backdrop-filter: blur(10px);
    }

    .ghost-button:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: #ffffff;
    }

    .ghost-button-icon {
      font-size: 13px;
    }

    .page-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cards-wrapper {
      width: 100%;
      max-width: 880px;
    }

    /* --- Step 1: two cards layout --- */

    .choice-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 32px;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .choice-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .choice-card {
      background: radial-gradient(circle at top left, #eef4ff 0, #ffffff 40%);
      border-radius: var(--radius-xl);
      border: 1px solid var(--card-border);
      box-shadow: 0 12px 35px rgba(15, 23, 42, 0.06);
      padding: 28px 24px 26px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition:
        transform 160ms ease-out,
        box-shadow 160ms ease-out,
        border-color 160ms ease-out,
        background 160ms ease-out;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .choice-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--card-shadow);
      border-color: var(--card-border-active);
      background: radial-gradient(circle at top left, #e0edff 0, #ffffff 45%);
    }

    .choice-main {
      display: flex;
      gap: 18px;
      align-items: center;
    }

    .choice-icon {
      width: 44px;
      height: 44px;
      border-radius: 18px;
      background: linear-gradient(135deg, #e0edff, #f5f7ff);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
    }

    .chip {
      font-size: 11px;
      border-radius: 999px;
      padding: 3px 9px;
      border: 1px solid rgba(148, 163, 184, 0.45);
      color: #64748b;
      background: rgba(255, 255, 255, 0.8);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .choice-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .choice-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .choice-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    .choice-footer {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      min-width: 140px;
    }

    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }

    .select-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }

    /* --- Step 2: layout wizard cards --- */

    .layout-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 28px;
      justify-content: center;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .layout-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .layout-card {
      background: radial-gradient(circle at top, #eef4ff 0, #ffffff 55%);
      border-radius: var(--radius-xl);
      border: 1px solid var(--card-border);
      box-shadow: 0 12px 35px rgba(15, 23, 42, 0.05);
      padding: 24px 22px 20px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 18px;
      transition:
        transform 160ms ease-out,
        box-shadow 160ms ease-out,
        border-color 160ms ease-out,
        background 160ms ease-out;
    }

    .layout-card:hover {
      transform: translateY(-2px);
      border-color: var(--card-border-active);
      box-shadow: var(--card-shadow);
      background: radial-gradient(circle at top, #e0edff 0, #ffffff 60%);
    }

    .layout-top {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .layout-icon {
      width: 40px;
      height: 40px;
      border-radius: 16px;
      background: linear-gradient(145deg, #e0edff, #f9fbff);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
    }

    .layout-title-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .layout-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .layout-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    .layout-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .layout-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .layout-pill {
      font-size: 11px;
      border-radius: 999px;
      padding: 3px 8px;
      border: 1px solid rgba(148, 163, 184, 0.45);
      color: #64748b;
      background: rgba(255, 255, 255, 0.9);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .layout-select-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
    }

    /* --- icons --- */

    .icon-grid {
      width: 20px;
      height: 20px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 1fr;
      gap: 2px;
    }

    .icon-grid span {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      background: #93c5fd;
    }

    .icon-rows {
      width: 20px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .icon-rows span {
      height: 4px;
      border-radius: 999px;
      background: #60a5fa;
    }

    .icon-mixed {
      width: 20px;
      height: 20px;
      position: relative;
    }

    .icon-mixed .block {
      position: absolute;
      border-radius: 4px;
      background: #93c5fd;
    }

    .icon-mixed .block.a {
      inset: 0 8px 8px 0;
    }

    .icon-mixed .block.b {
      inset: 8px 0 0 8px;
      background: #bfdbfe;
    }

    .icon-blank {
      width: 20px;
      height: 14px;
      border-radius: 6px;
      border: 2px solid #93c5fd;
      background: #eff6ff;
    }

    /* --- NEW: saved template panel --- */

    .template-panel {
      margin-top: 32px;
      padding: 18px 20px;
      border-radius: 20px;
      border: 1px dashed rgba(148, 163, 184, 0.6);
      background: linear-gradient(135deg, #f8fafc, #eef4ff);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .template-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .template-title {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .template-subtitle {
      font-size: 12px;
      color: var(--text-muted);
    }

    .template-form {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }

    .template-select {
      min-width: 220px;
      flex: 1;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      padding: 7px 11px;
      font-size: 13px;
      font-family: inherit;
      background: #ffffff;
      color: var(--text-main);
    }

    .template-button {
      border-radius: 999px;
      border: 0;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      background: var(--accent);
      color: #ffffff;
      cursor: pointer;
      box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .template-button:hover {
      filter: brightness(1.03);
      transform: translateY(-1px);
    }

    .template-empty {
      font-size: 12px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <div class="page-header-left">
        ${stepText}
        <div class="headline">${title}</div>
      </div>
      <div class="page-header-right">
        <a class="ghost-button" href="/admin/ui/shows/${showId}/edit">
          <span class="ghost-button-icon">←</span>
          <span>Back to event details</span>
        </a>
      </div>
    </header>
    <main class="page-body">
      <div class="cards-wrapper">
        ${body}
      </div>
    </main>
  </div>
</body>
</html>`;

  return html;
}

/**
 * STEP 1 (of 4) — Unallocated vs Allocated seating
 * Route: GET /admin/seating-choice/:showId
 */
router.get("/seating-choice/:showId", (req, res) => {
  const { showId } = req.params;

  const body = `
    <section class="choice-grid">
      <article class="choice-card" data-choice="unallocated">
        <div class="choice-main">
          <div class="choice-icon">
            <div class="icon-rows">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="choice-meta">
            <div class="choice-title">Unallocated seating</div>
            <div class="choice-desc">
              Simple tickets, no seat map. Perfect for comedy clubs and general admission events.
            </div>
          </div>
        </div>
        <div class="choice-footer">
          <div class="chip-row">
            <div class="chip">Quick to set up</div>
            <div class="chip">Best for GA rooms</div>
          </div>
          <div class="select-label">Choose this style</div>
        </div>
      </article>

      <article class="choice-card" data-choice="allocated">
        <div class="choice-main">
          <div class="choice-icon">
            <div class="icon-grid">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
          </div>
          <div class="choice-meta">
            <div class="choice-title">Allocated seating</div>
            <div class="choice-desc">
              Build a detailed seating map. Let customers pick exact seats by price and area.
            </div>
          </div>
        </div>
        <div class="choice-footer">
          <div class="chip-row">
            <div class="chip">Seat picker</div>
            <div class="chip">Zones &amp; price levels</div>
          </div>
          <div class="select-label">Choose this style</div>
        </div>
      </article>
    </section>

    <script>
      (function () {
        var showId = "${showId}";
        var cards = document.querySelectorAll(".choice-card");
        if (!cards || !cards.length) return;

        cards.forEach(function (card) {
          card.addEventListener("click", function () {
            var choice = card.getAttribute("data-choice");
            if (choice === "unallocated") {
              window.location.href = "/admin/seating/unallocated/" + showId;
            } else if (choice === "allocated") {
              window.location.href = "/admin/seating/layout-wizard/" + showId;
            }
          });
        });
      })();
    </script>
  ";

  const html = renderShell({
    title: "How do you want to sell seats for this event?",
    body,
    stepLabel: "Step 1 of 4 · Seating style",
    showId,
  });

  res.status(200).send(html);
});

/**
 * STEP 2 (of 4) — Layout type (tables, rows, mixed, blank)
 * Route: GET /admin/seating/layout-wizard/:showId
 *
 * NOW WITH:
 *   C) "Load a saved seating template for this venue"
 */
router.get("/seating/layout-wizard/:showId", async (req, res) => {
  const { showId } = req.params;

  // Default panel text if we can't find anything
  let templatesHtml = `
    <section class="template-panel">
      <p class="template-empty">
        Once you've saved a layout for this venue, you'll be able to reuse it here.
      </p>
    </section>
  `;

  try {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { venueId: true }
    });

    if (show?.venueId) {
      // Try to pick up a user ID if auth middleware has attached one.
      const anyReq: any = req;
      const currentUserId =
        anyReq.user?.id ||
        anyReq.user?.sub ||
        anyReq.user?.userId ||
        null;

      const where: any = {
        venueId: show.venueId,
        isTemplate: true
      };

      if (currentUserId) {
        where.createdByUserId = currentUserId;
      }

      const templates = await prisma.seatMap.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, version: true }
      });

      if (templates.length > 0) {
        const options = templates
          .map(
            (t) =>
              `<option value="${t.id}">${t.name || "Saved layout"} (v${t.version ?? 1})</option>`
          )
          .join("");

        templatesHtml = `
          <section class="template-panel">
            <div class="template-header">
              <div class="template-title">Or load a saved layout for this venue</div>
              <div class="template-subtitle">
                These layouts were created for this venue by you. Pick one to jump straight into the builder.
              </div>
            </div>
            <form class="template-form" method="GET" action="/admin/seating/builder/preview/${showId}">
              <input type="hidden" name="layout" value="tables" />
              <select name="seatMapId" class="template-select">
                <option value="">Select a saved layout…</option>
                ${options}
              </select>
              <button type="submit" class="template-button">
                Use this layout
              </button>
            </form>
          </section>
        `;
      }
    }
  } catch (err) {
    console.error("layout-wizard templates lookup failed", err);
  }

  const body = `
    <section class="layout-grid">
      <article class="layout-card" data-layout="tables">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-grid">
              <span></span><span></span>
              <span></span><span></span>
            </div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Tables &amp; chairs</div>
            <div class="layout-desc">
              Cabaret-style maps with round or long tables and seats auto-generated around them.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Comedy rooms</span>
            <span class="layout-pill">Drinks &amp; tables</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>

      <article class="layout-card" data-layout="sections">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-rows">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Sections &amp; rows</div>
            <div class="layout-desc">
              Classic theatre blocks with aisles, numbered rows and fixed seating.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Stalls / circle</span>
            <span class="layout-pill">Fixed seating</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>

      <article class="layout-card" data-layout="mixed">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-mixed">
              <div class="block a"></div>
              <div class="block b"></div>
            </div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Mixed seating</div>
            <div class="layout-desc">
              Blend tables, rows and standing zones in a single flexible map.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Flexible setups</span>
            <span class="layout-pill">VIP areas</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>

      <article class="layout-card" data-layout="blank">
        <div class="layout-top">
          <div class="layout-icon">
            <div class="icon-blank"></div>
          </div>
          <div class="layout-title-block">
            <div class="layout-title">Blank canvas</div>
            <div class="layout-desc">
              Start from an empty room and add only the tables, rows and zones you need.
            </div>
          </div>
        </div>
        <div class="layout-bottom">
          <div class="layout-tags">
            <span class="layout-pill">Any configuration</span>
            <span class="layout-pill">Full control</span>
          </div>
          <div class="layout-select-label">Use this layout</div>
        </div>
      </article>
    </section>

    ${templatesHtml}

    <script>
      (function () {
        var showId = "${showId}";
        var cards = document.querySelectorAll(".layout-card");
        if (!cards || !cards.length) return;

        cards.forEach(function (card) {
          card.addEventListener("click", function () {
            var layout = card.getAttribute("data-layout") || "tables";
            var url = "/admin/seating/builder/preview/" + showId + "?layout=" + layout;
            window.location.href = url;
          });
        });
      })();
    </script>
  `;

  const html = renderShell({
    title: "How would you like this room to look?",
    body,
    stepLabel: "Step 2 of 4 · Layout style",
    showId,
  });

  res.status(200).send(html);
});

/**
 * STEP 1 — UNALLOCATED stub
 * Route: GET /admin/seating/unallocated/:showId
 * (For now, just a placeholder until we plug in the ticket-types screen.)
 */
router.get("/seating/unallocated/:showId", (req, res) => {
  const { showId } = req.params;
  res.status(200).send({
    message:
      "Unallocated seating setup page stub. This will lead to ticket-type creation for show " +
      showId,
  });
});

/**
 * STEP 3 — Builder preview stub
 * Route: GET /admin/seating/builder/preview/:showId
 * (Full-screen editor will live in a separate router; this is a temporary stub.)
 */

export default router;