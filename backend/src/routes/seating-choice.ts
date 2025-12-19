// backend/src/routes/seating-choice.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

function escapeHtml(str: string | null | undefined) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

    /* --- Unallocated ticket editor --- */
    .tickets-card {
      background: #ffffff;
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      padding: 24px;
      box-shadow: var(--card-shadow);
    }

    .tickets-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .tickets-header h2 {
      margin: 6px 0 4px;
      font-size: 20px;
      letter-spacing: -0.01em;
    }

    .eyebrow {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .subtext {
      margin: 0;
      color: var(--text-muted);
      font-size: 13px;
    }

    .show-chip {
      padding: 10px 14px;
      background: var(--accent-soft);
      border-radius: var(--radius-pill);
      border: 1px solid var(--card-border);
      display: inline-flex;
      flex-direction: column;
      min-width: 220px;
    }

    .chip-title {
      font-weight: 650;
      font-size: 14px;
    }

    .chip-meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .tickets-table {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .table-row {
      display: grid;
      grid-template-columns: 1.2fr 0.6fr 0.6fr 0.8fr 0.8fr 120px;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      background: #f8fbff;
    }

    .table-head {
      background: transparent;
      border: none;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      padding-top: 0;
      padding-bottom: 0;
    }

    .input {
      width: 100%;
      padding: 9px 10px;
      border-radius: 10px;
      border: 1px solid #d7dfef;
      font-size: 14px;
      background: #fff;
    }

    .row-actions {
      text-align: right;
      display: flex;
      justify-content: flex-end;
    }

    .tickets-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
    }

    .action-spacer { flex: 1; }

    .primary-button {
      border-radius: var(--radius-pill);
      border: none;
      padding: 10px 16px;
      background: #2563eb;
      color: #fff;
      font-weight: 650;
      cursor: pointer;
      box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
    }

    .primary-button:hover { background: #1d4ed8; }

    .status-row {
      margin-top: 10px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .status-row[data-tone="success"] { color: #0f9f6e; }
    .status-row[data-tone="error"] { color: #dc2626; }

    .empty {
      padding: 12px;
      background: #f8fafc;
      border: 1px dashed var(--card-border);
      border-radius: var(--radius-lg);
      color: var(--text-muted);
      text-align: center;
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
 * STEP 1 (of 2) — Unallocated vs Allocated seating
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
              window.location.href = "/admin/seating/builder/preview/" + showId + "?layout=blank";
            }
          });
        });
      })();
    </script>
  `;

  const html = renderShell({
    title: "How do you want to sell seats for this event?",
    body,
    stepLabel: "Step 1 of 2 · Seating style",
    showId,
  });

  res.status(200).send(html);
});

/**
 * STEP 2 (of 4) — Layout type (tables, rows, mixed, blank)
 * Route: GET /admin/seating/layout-wizard/:showId
 */
router.get("/seating/layout-wizard/:showId", (req, res) => {
  const { showId } = req.params;

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
 * STEP 2 — Unallocated tickets editor
 * Route: GET /admin/seating/unallocated/:showId
 */
router.get("/seating/unallocated/:showId", async (req, res) => {
  const { showId } = req.params;

  try {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: { select: { name: true, city: true, capacity: true } },
        ticketTypes: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!show) {
      return res.status(404).send("Show not found");
    }

    const initialTickets = (show.ticketTypes || []).map((t) => ({
      id: t.id,
      name: t.name,
      price: (t.pricePence || 0) / 100,
      available: t.available == null ? "" : String(t.available),
      onSaleAt: t.onSaleAt ? new Date(t.onSaleAt).toISOString() : "",
      offSaleAt: t.offSaleAt ? new Date(t.offSaleAt).toISOString() : "",
    }));

    const showMeta = {
      id: show.id,
      title: show.title || "Untitled show",
      date: show.date ? new Date(show.date).toISOString() : null,
      venue: show.venue
        ? {
            name: show.venue.name,
            city: show.venue.city,
            capacity: show.venue.capacity ?? null,
          }
        : null,
    };

    const body = `
      <section class="tickets-card">
        <header class="tickets-header">
          <div>
            <div class="eyebrow">Unallocated seating</div>
            <h2>Create general admission tickets</h2>
            <p class="subtext">Set ticket names, prices, allocations and on/off sale windows before publishing.</p>
          </div>
          <div class="show-chip">
            <span class="chip-title">${escapeHtml(show.title || "Untitled show")}</span>
            ${show.venue ? `<span class="chip-meta">${escapeHtml(show.venue.name)}${show.venue.city ? " · " + escapeHtml(show.venue.city) : ""}</span>` : ""}
          </div>
        </header>

        <div class="tickets-table" id="tickets-table"></div>

        <div class="tickets-actions">
          <button class="ghost-button" type="button" id="add-ticket">+ Add ticket</button>
          <div class="action-spacer"></div>
          <button class="ghost-button" type="button" id="save-tickets">Save tickets</button>
          <button class="primary-button" type="button" id="publish">Create &amp; publish show</button>
        </div>
        <div class="status-row" id="status-row"></div>
      </section>

      <script>
        (function () {
          var showId = ${JSON.stringify(showId)};
          var initialTickets = ${JSON.stringify(initialTickets)};
          var showMeta = ${JSON.stringify(showMeta)};

          var tickets = (initialTickets || []).map(function (t) {
            return Object.assign({}, t);
          });
          var table = document.getElementById("tickets-table");
          var statusRow = document.getElementById("status-row");
          var defaultAllocation = (showMeta && showMeta.venue && showMeta.venue.capacity) || "";

          function isoToInput(val) {
            if (!val) return "";
            try {
              return new Date(val).toISOString().slice(0, 16);
            } catch (e) {
              return "";
            }
          }

          function renderTickets() {
            if (!table) return;
            if (!tickets.length) {
              table.innerHTML = '<div class="empty">No tickets yet. Add your first ticket.</div>';
              return;
            }

            table.innerHTML = '';
            var header = document.createElement('div');
            header.className = 'table-row table-head';
            header.innerHTML = '<div>Name</div><div>Price (£)</div><div>Allocation</div><div>On sale</div><div>Off sale</div><div></div>';
            table.appendChild(header);

            tickets.forEach(function (t, idx) {
              var row = document.createElement('div');
              row.className = 'table-row';

              row.innerHTML = \`
                <div><input class="input" value="\${t.name || ''}" data-field="name" data-idx="\${idx}" placeholder="Ticket name" /></div>
                <div><input class="input" value="\${t.price ?? ''}" data-field="price" data-idx="\${idx}" type="number" min="0" step="0.01" placeholder="0.00" /></div>
                <div><input class="input" value="\${t.available ?? ''}" data-field="available" data-idx="\${idx}" type="number" min="0" placeholder="Auto" /></div>
                <div><input class="input" value="\${isoToInput(t.onSaleAt)}" data-field="onSaleAt" data-idx="\${idx}" type="datetime-local" /></div>
                <div><input class="input" value="\${isoToInput(t.offSaleAt)}" data-field="offSaleAt" data-idx="\${idx}" type="datetime-local" /></div>
                <div class="row-actions">
                  <button class="ghost-button" data-action="delete" data-idx="\${idx}" type="button">Remove</button>
                </div>
              \`;

              row.querySelectorAll('input').forEach(function (input) {
                input.addEventListener('input', function () {
                  var index = Number(input.getAttribute('data-idx'));
                  var field = input.getAttribute('data-field');
                  if (!field || Number.isNaN(index)) return;
                  tickets[index][field] = input.value;
                });
              });

              var delBtn = row.querySelector('[data-action="delete"]');
              if (delBtn) {
                delBtn.addEventListener('click', function () {
                  removeTicket(idx);
                });
              }

              table.appendChild(row);
            });
          }

          function showStatus(msg, tone) {
            if (!statusRow) return;
            statusRow.textContent = msg || '';
            statusRow.setAttribute('data-tone', tone || '');
          }

          async function jsonRequest(url, options) {
            var res = await fetch(url, options || {});
            if (!res.ok) {
              var text = '';
              try {
                var data = await res.json();
                text = data?.message || data?.error || res.statusText;
              } catch (e) {
                text = res.statusText;
              }
              throw new Error(text || 'Request failed');
            }
            try {
              return await res.json();
            } catch (e) {
              return null;
            }
          }

          function removeTicket(idx) {
            var t = tickets[idx];
            tickets.splice(idx, 1);
            renderTickets();
            if (t && t.id) {
              fetch('/admin/ticket-types/' + t.id, { method: 'DELETE', credentials: 'include' }).catch(function () {});
            }
          }

          function toPayload(t) {
            var pricePence = Math.round(Number(t.price || 0) * 100);
            var available = t.available === '' || t.available == null ? null : Number(t.available);
            return {
              name: (t.name || '').trim(),
              pricePence: pricePence,
              available: Number.isFinite(available) ? available : null,
              onSaleAt: t.onSaleAt ? new Date(t.onSaleAt).toISOString() : null,
              offSaleAt: t.offSaleAt ? new Date(t.offSaleAt).toISOString() : null,
            };
          }

          async function saveTickets() {
            showStatus('Saving tickets…');
            try {
              for (var i = 0; i < tickets.length; i++) {
                var t = tickets[i];
                var payload = toPayload(t);
                if (!payload.name) {
                  showStatus('Ticket name is required for all rows.', 'error');
                  return;
                }

                if (t.id) {
                  await jsonRequest('/admin/ticket-types/' + t.id, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                } else {
                  var data = await jsonRequest('/admin/shows/' + showId + '/ticket-types', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                  if (data && data.ticketType && data.ticketType.id) {
                    tickets[i].id = data.ticketType.id;
                  }
                }
              }
              showStatus('Tickets saved.', 'success');
              renderTickets();
              return true;
            } catch (err) {
              showStatus(err && err.message ? err.message : 'Failed to save tickets', 'error');
              console.error(err);
              throw err;
            }
          }

          async function publishShow() {
            try {
              await saveTickets();
              showStatus('Publishing…');
              await jsonRequest('/admin/shows/' + showId, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'LIVE' }),
              });
              showStatus('Show published with unallocated tickets.', 'success');
            } catch (err) {
              showStatus(err && err.message ? err.message : 'Publish failed', 'error');
              console.error(err);
            }
          }

          var addBtn = document.getElementById('add-ticket');
          if (addBtn) {
            addBtn.addEventListener('click', function () {
              tickets.push({ name: '', price: '', available: defaultAllocation, onSaleAt: '', offSaleAt: '' });
              renderTickets();
            });
          }

          var saveBtn = document.getElementById('save-tickets');
          if (saveBtn) saveBtn.addEventListener('click', function () { saveTickets(); });
          var publishBtn = document.getElementById('publish');
          if (publishBtn) publishBtn.addEventListener('click', function () { publishShow(); });

          renderTickets();
        })();
      </script>
    `;

    const html = renderShell({
      title: "Create unallocated tickets",
      body,
      stepLabel: "Step 2 of 2 · Unallocated tickets",
      showId,
    });

    res.status(200).send(html);
  } catch (e) {
    console.error("Error rendering unallocated page", e);
    res.status(500).send("Failed to load unallocated ticket setup");
  }
});

/**
 * STEP 3 — Builder preview lives in admin-seating-builder.ts
 * Route there: GET /admin/seating/builder/preview/:showId
 */

export default router;
