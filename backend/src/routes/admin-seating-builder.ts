// backend/src/routes/admin-seating-builder.ts
import { Router } from "express";

const router = Router();

/**
 * Full-screen seating builder shell.
 *
 * Route: GET /admin/seating/builder/:showId
 *
 * Query param: ?layout=tables|sections|mixed|blank
 *
 * - If layout=blank → go straight to empty canvas.
 * - Otherwise → show a centred config panel (tables/rows/mixed).
 *   When "Generate layout" is clicked we currently:
 *     - Log the chosen values in the console
 *     - Hide the overlay and reveal the canvas
 *
 * Next step after this shell is in place will be:
 * - Actually generating seat/table/section objects into the canvas
 *   and then persisting them via your existing seatmap APIs.
 */

router.get("/seating/builder/:showId", (req, res) => {
  const { showId } = req.params;
  const layout = (req.query.layout as string) || "tables";

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Seat builder – Chuckl. Admin</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      --bg: #f5f7ff;
      --bg-soft: #edf1ff;
      --panel: #ffffff;
      --border-subtle: #dde4ff;
      --border-strong: #4b66ff;
      --text-main: #111827;
      --text-muted: #6b7280;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.08);
      --danger: #ef4444;
      --radius-lg: 20px;
      --radius-md: 12px;
      --shadow-soft: 0 18px 45px rgba(15, 23, 42, 0.10);
      --shadow-subtle: 0 12px 30px rgba(15, 23, 42, 0.06);
      --grid-line: rgba(148, 163, 184, 0.15);
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
                   "Helvetica Neue", Arial, sans-serif;
      background: radial-gradient(circle at top left, #eef2ff 0, #f5f7ff 40%, #f9fafb 100%);
      color: var(--text-main);
    }

    body {
      display: flex;
      flex-direction: column;
    }

    .builder-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    /* Top bar */

    .builder-topbar {
      height: 56px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      background: linear-gradient(to bottom, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
      backdrop-filter: blur(10px);
      position: relative;
      z-index: 10;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .topbar-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.06);
      font-size: 11px;
      font-weight: 500;
      color: var(--accent);
    }

    .topbar-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
    }

    .topbar-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    .topbar-sub {
      font-size: 12px;
      color: var(--text-muted);
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .topbar-link {
      border: 0;
      background: transparent;
      font-size: 12px;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .topbar-link:hover {
      background: rgba(148, 163, 184, 0.12);
      color: var(--text-main);
    }

    .primary-btn {
      border-radius: 999px;
      border: none;
      background: var(--accent);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.28);
      transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.08s ease;
    }

    .primary-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 16px 32px rgba(37, 99, 235, 0.32);
      background: #1d4ed8;
    }

    .primary-btn:active {
      transform: translateY(0);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
    }

    /* Main layout */

    .builder-main {
      flex: 1;
      display: flex;
      min-height: 0;
    }

    .builder-canvas-wrap {
      flex: 1;
      position: relative;
      padding: 16px 0 16px 16px;
      min-width: 0;
    }

    .builder-canvas {
      height: 100%;
      width: 100%;
      border-radius: 24px;
      background:
        linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
      background-size: 32px 32px;
      background-color: #f9fafb;
      box-shadow: var(--shadow-soft);
      position: relative;
      overflow: hidden;
    }

    .canvas-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      color: var(--text-muted);
      font-size: 13px;
    }

    .canvas-placeholder-inner {
      padding: 12px 16px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.78);
      color: #e5e7eb;
      backdrop-filter: blur(8px);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.45);
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .canvas-pill-key {
      padding: 3px 7px;
      border-radius: 6px;
      border: 1px solid rgba(148, 163, 184, 0.6);
      background: rgba(15, 23, 42, 0.7);
      font-size: 11px;
    }

    /* Right sidebar */

    .builder-sidebar {
      width: 260px;
      border-left: 1px solid rgba(148, 163, 184, 0.25);
      background: radial-gradient(circle at top, #eef2ff 0, #f9fafb 40%, #ffffff 100%);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sidebar-section {
      background: rgba(255, 255, 255, 0.9);
      border-radius: 20px;
      padding: 12px 12px 10px;
      box-shadow: var(--shadow-subtle);
      border: 1px solid rgba(209, 213, 219, 0.6);
    }

    .sidebar-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .sidebar-title {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7280;
    }

    .sidebar-badge {
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 10px;
      background: rgba(37, 99, 235, 0.06);
      color: var(--accent);
    }

    .sidebar-body {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .tool-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .tool-pill {
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.5);
      font-size: 11px;
      color: #4b5563;
      background: rgba(249, 250, 251, 0.9);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: default;
    }

    .tool-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.18);
      border: 1px solid var(--accent);
    }

    /* Overlay config panel */

    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.55));
      z-index: 20;
    }

    .overlay-inner {
      width: 460px;
      max-width: calc(100% - 40px);
      background: linear-gradient(to bottom right, #ffffff, #eef2ff);
      border-radius: 24px;
      box-shadow: 0 26px 70px rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(129, 140, 248, 0.5);
      padding: 20px 22px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .overlay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .overlay-title-block {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .overlay-kicker {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6b7280;
    }

    .overlay-title {
      font-size: 18px;
      font-weight: 650;
      letter-spacing: 0.01em;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .overlay-icon {
      width: 28px;
      height: 28px;
      border-radius: 10px;
      background: radial-gradient(circle at top left, #e0ecff, #c7d2fe);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #1d4ed8;
      box-shadow: 0 10px 22px rgba(79, 70, 229, 0.35);
    }

    .overlay-sub {
      font-size: 12px;
      color: #6b7280;
      max-width: 320px;
    }

    .overlay-close {
      border-radius: 999px;
      border: none;
      background: rgba(15, 23, 42, 0.06);
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #4b5563;
    }

    .overlay-close:hover {
      background: rgba(15, 23, 42, 0.12);
    }

    .overlay-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 14px;
      margin-top: 2px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .field label {
      color: #4b5563;
      font-weight: 500;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }

    .field-hint {
      font-weight: 400;
      color: #9ca3af;
      font-size: 11px;
    }

    .field input[type="number"] {
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.9);
      padding: 7px 9px;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      width: 100%;
      background: rgba(248, 250, 252, 0.9);
    }

    .field input[type="number"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent-soft);
      background: #ffffff;
    }

    .overlay-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
    }

    .overlay-meta {
      font-size: 11px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .overlay-meta-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.3);
    }

    .overlay-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ghost-btn {
      border-radius: 999px;
      border: 0;
      background: transparent;
      font-size: 12px;
      color: #6b7280;
      padding: 6px 10px;
      cursor: pointer;
    }

    .ghost-btn:hover {
      background: rgba(148, 163, 184, 0.12);
      color: #111827;
    }

    .primary-small {
      padding: 7px 13px;
      font-size: 12px;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.32);
    }

    .hidden {
      display: none !important;
    }

    @media (max-width: 900px) {
      .builder-main {
        flex-direction: column;
      }
      .builder-sidebar {
        width: 100%;
        border-left: none;
        border-top: 1px solid rgba(148, 163, 184, 0.25);
        flex-direction: row;
        overflow-x: auto;
      }
      .sidebar-section {
        min-width: 200px;
      }
    }
  </style>
</head>
<body>
  <div class="builder-root">
    <header class="builder-topbar">
      <div class="topbar-left">
        <button class="topbar-link" type="button" id="js-back-to-layouts">
          <span aria-hidden="true">←</span>
          <span>Back to layouts</span>
        </button>
        <div class="topbar-title-block">
          <div class="topbar-title">Seat map builder</div>
          <div class="topbar-sub">Show ID: ${showId}</div>
        </div>
        <div class="topbar-pill">
          <span class="topbar-pill-dot"></span>
          Live preview
        </div>
      </div>
      <div class="topbar-right">
        <button class="topbar-link" type="button" id="js-reset-layout">
          Reset canvas
        </button>
        <button class="primary-btn" type="button" id="js-save-and-continue">
          <span>Save &amp; continue to pricing</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </header>

    <main class="builder-main">
      <section class="builder-canvas-wrap">
        <div class="builder-canvas" id="js-canvas">
          <div class="canvas-placeholder" id="js-canvas-placeholder">
            <div class="canvas-placeholder-inner">
              <span>Drag, zoom and drop tables, rows and zones here.</span>
              <span class="canvas-pill-key">Scroll ⌥+Trackpad to zoom</span>
            </div>
          </div>

          <!-- Overlay config panels will sit on top of the canvas -->
          <div class="overlay" id="js-config-overlay">
            <!-- Tables & chairs -->
            <div class="overlay-inner" data-layout-panel="tables">
              <div class="overlay-header">
                <div class="overlay-title-block">
                  <div class="overlay-kicker">Layout generator</div>
                  <div class="overlay-title">
                    <span class="overlay-icon">🍽</span>
                    <span>Tables &amp; chairs</span>
                  </div>
                  <div class="overlay-sub">
                    Tell us roughly how many tables and seats you need.
                    We’ll drop a starting layout you can still tweak in the canvas.
                  </div>
                </div>
                <button class="overlay-close" type="button" data-close-overlay>
                  ✕
                </button>
              </div>

              <div class="overlay-grid">
                <div class="field">
                  <label>
                    Number of tables
                    <span class="field-hint">e.g. 12</span>
                  </label>
                  <input type="number" min="1" value="12" id="tables-count">
                </div>
                <div class="field">
                  <label>
                    Seats per table
                    <span class="field-hint">e.g. 8</span>
                  </label>
                  <input type="number" min="1" value="8" id="seats-per-table">
                </div>
                <div class="field">
                  <label>
                    Table spacing
                    <span class="field-hint">pixels</span>
                  </label>
                  <input type="number" min="16" value="80" id="table-spacing">
                </div>
                <div class="field">
                  <label>
                    Ring depth
                    <span class="field-hint">rows of tables</span>
                  </label>
                  <input type="number" min="1" value="3" id="table-rings">
                </div>
              </div>

              <div class="overlay-footer">
                <div class="overlay-meta">
                  <span class="overlay-meta-dot"></span>
                  <span id="tables-estimate">Estimated seats: 96</span>
                </div>
                <div class="overlay-actions">
                  <button class="ghost-btn" type="button" data-skip-generate>
                    Start from blank instead
                  </button>
                  <button class="primary-btn primary-small" type="button" data-generate-layout="tables">
                    Generate layout
                  </button>
                </div>
              </div>
            </div>

            <!-- Sections & rows -->
            <div class="overlay-inner hidden" data-layout-panel="sections">
              <div class="overlay-header">
                <div class="overlay-title-block">
                  <div class="overlay-kicker">Layout generator</div>
                  <div class="overlay-title">
                    <span class="overlay-icon">🎭</span>
                    <span>Sections &amp; rows</span>
                  </div>
                  <div class="overlay-sub">
                    Classic theatre-style seating. We’ll auto-build sections and rows,
                    ready for you to rename or resize.
                  </div>
                </div>
                <button class="overlay-close" type="button" data-close-overlay>
                  ✕
                </button>
              </div>

              <div class="overlay-grid">
                <div class="field">
                  <label>
                    Number of sections
                    <span class="field-hint">stalls, circle…</span>
                  </label>
                  <input type="number" min="1" value="3" id="sections-count">
                </div>
                <div class="field">
                  <label>
                    Rows per section
                    <span class="field-hint">e.g. 8</span>
                  </label>
                  <input type="number" min="1" value="8" id="rows-per-section">
                </div>
                <div class="field">
                  <label>
                    Seats per row
                    <span class="field-hint">e.g. 12</span>
                  </label>
                  <input type="number" min="1" value="12" id="seats-per-row">
                </div>
                <div class="field">
                  <label>
                    Row spacing
                    <span class="field-hint">pixels</span>
                  </label>
                  <input type="number" min="16" value="48" id="row-spacing">
                </div>
              </div>

              <div class="overlay-footer">
                <div class="overlay-meta">
                  <span class="overlay-meta-dot"></span>
                  <span id="sections-estimate">Estimated seats: 288</span>
                </div>
                <div class="overlay-actions">
                  <button class="ghost-btn" type="button" data-skip-generate>
                    Start from blank instead
                  </button>
                  <button class="primary-btn primary-small" type="button" data-generate-layout="sections">
                    Generate layout
                  </button>
                </div>
              </div>
            </div>

            <!-- Mixed seating -->
            <div class="overlay-inner hidden" data-layout-panel="mixed">
              <div class="overlay-header">
                <div class="overlay-title-block">
                  <div class="overlay-kicker">Layout generator</div>
                  <div class="overlay-title">
                    <span class="overlay-icon">🎟</span>
                    <span>Mixed seating</span>
                  </div>
                  <div class="overlay-sub">
                    Blend cabaret tables with theatre rows. Great for premium front tables
                    and tiered seating behind.
                  </div>
                </div>
                <button class="overlay-close" type="button" data-close-overlay>
                  ✕
                </button>
              </div>

              <div class="overlay-grid">
                <div class="field">
                  <label>
                    Sections
                    <span class="field-hint">count</span>
                  </label>
                  <input type="number" min="0" value="2" id="mixed-sections-count">
                </div>
                <div class="field">
                  <label>
                    Rows per section
                    <span class="field-hint">e.g. 6</span>
                  </label>
                  <input type="number" min="0" value="6" id="mixed-rows-per-section">
                </div>
                <div class="field">
                  <label>
                    Seats per row
                    <span class="field-hint">e.g. 10</span>
                  </label>
                  <input type="number" min="0" value="10" id="mixed-seats-per-row">
                </div>
                <div class="field">
                  <label>
                    Tables
                    <span class="field-hint">front of room</span>
                  </label>
                  <input type="number" min="0" value="6" id="mixed-tables-count">
                </div>
                <div class="field">
                  <label>
                    Seats per table
                    <span class="field-hint">e.g. 8</span>
                  </label>
                  <input type="number" min="0" value="8" id="mixed-seats-per-table">
                </div>
                <div class="field">
                  <label>
                    Approx capacity goal
                    <span class="field-hint">optional</span>
                  </label>
                  <input type="number" min="0" value="250" id="mixed-capacity-goal">
                </div>
              </div>

              <div class="overlay-footer">
                <div class="overlay-meta">
                  <span class="overlay-meta-dot"></span>
                  <span id="mixed-estimate">Estimated seats: 248</span>
                </div>
                <div class="overlay-actions">
                  <button class="ghost-btn" type="button" data-skip-generate>
                    Start from blank instead
                  </button>
                  <button class="primary-btn primary-small" type="button" data-generate-layout="mixed">
                    Generate layout
                  </button>
                </div>
              </div>
            </div>
          </div>
          <!-- end overlay -->
        </div>
      </section>

      <aside class="builder-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title-row">
            <div class="sidebar-title">Tools</div>
            <div class="sidebar-badge">Coming to life</div>
          </div>
          <div class="sidebar-body">
            Drag, zoom and pan around the canvas. In the next pass we’ll light up
            tools for adding <strong>sections</strong>, <strong>tables</strong>,
            <strong>rows</strong> and <strong>holds</strong>.
          </div>
          <div class="tool-row">
            <div class="tool-pill">
              <span class="tool-dot"></span> Sections
            </div>
            <div class="tool-pill">
              <span class="tool-dot"></span> Tables
            </div>
            <div class="tool-pill">
              <span class="tool-dot"></span> Rows
            </div>
            <div class="tool-pill">
              <span class="tool-dot"></span> Zones
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-title-row">
            <div class="sidebar-title">Keyboard</div>
          </div>
          <div class="sidebar-body">
            <div class="tool-row">
              <div class="tool-pill"><span class="canvas-pill-key">⌘ + Z</span> Undo</div>
              <div class="tool-pill"><span class="canvas-pill-key">⌘ + Y</span> Redo</div>
              <div class="tool-pill"><span class="canvas-pill-key">⇧ + Drag</span> Multi-select</div>
              <div class="tool-pill"><span class="canvas-pill-key">⌥ + Scroll</span> Zoom</div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>

  <script>
    (function() {
      var showId = ${JSON.stringify(showId)};
      var initialLayout = ${JSON.stringify(layout || "tables")};

      var overlay = document.getElementById("js-config-overlay");
      var canvasPlaceholder = document.getElementById("js-canvas-placeholder");

      function showPanel(name) {
        var panels = overlay.querySelectorAll("[data-layout-panel]");
        panels.forEach(function(panel) {
          if (panel.getAttribute("data-layout-panel") === name) {
            panel.classList.remove("hidden");
          } else {
            panel.classList.add("hidden");
          }
        });
      }

      // Decide whether overlay is visible at all
      if (!initialLayout || initialLayout === "blank") {
        if (overlay) overlay.classList.add("hidden");
      } else {
        showPanel(initialLayout);
      }

      // Back button -> layout wizard step
      var backBtn = document.getElementById("js-back-to-layouts");
      if (backBtn) {
        backBtn.addEventListener("click", function() {
          window.location.href = "/admin/seating/layout-wizard/" + encodeURIComponent(showId);
        });
      }

      // Save & continue -> pricing step (placeholder for now)
      var saveBtn = document.getElementById("js-save-and-continue");
      if (saveBtn) {
        saveBtn.addEventListener("click", function() {
          // Later this will POST seatmap + redirect to pricing
          alert("In the next pass this will save the map and move you to ticket pricing.");
        });
      }

      // Reset canvas placeholder handler (for now just shows helper text again)
      var resetBtn = document.getElementById("js-reset-layout");
      if (resetBtn) {
        resetBtn.addEventListener("click", function() {
          if (canvasPlaceholder) {
            canvasPlaceholder.style.opacity = "1";
          }
          // Later: wipe in-memory shapes
        });
      }

      // Close overlay buttons
      overlay.querySelectorAll("[data-close-overlay]").forEach(function(btn) {
        btn.addEventListener("click", function() {
          overlay.classList.add("hidden");
        });
      });

      // "Start from blank instead" buttons
      overlay.querySelectorAll("[data-skip-generate]").forEach(function(btn) {
        btn.addEventListener("click", function() {
          overlay.classList.add("hidden");
        });
      });

      // Simple capacity estimates
      function updateTablesEstimate() {
        var tables = parseInt((document.getElementById("tables-count") || {}).value || "0", 10);
        var seats = parseInt((document.getElementById("seats-per-table") || {}).value || "0", 10);
        var el = document.getElementById("tables-estimate");
        if (el) el.textContent = "Estimated seats: " + (tables * seats || 0);
      }

      function updateSectionsEstimate() {
        var sections = parseInt((document.getElementById("sections-count") || {}).value || "0", 10);
        var rows = parseInt((document.getElementById("rows-per-section") || {}).value || "0", 10);
        var seats = parseInt((document.getElementById("seats-per-row") || {}).value || "0", 10);
        var el = document.getElementById("sections-estimate");
        if (el) el.textContent = "Estimated seats: " + (sections * rows * seats || 0);
      }

      function updateMixedEstimate() {
        var sCount = parseInt((document.getElementById("mixed-sections-count") || {}).value || "0", 10);
        var rows = parseInt((document.getElementById("mixed-rows-per-section") || {}).value || "0", 10);
        var seatsRow = parseInt((document.getElementById("mixed-seats-per-row") || {}).value || "0", 10);
        var tables = parseInt((document.getElementById("mixed-tables-count") || {}).value || "0", 10);
        var seatsTable = parseInt((document.getElementById("mixed-seats-per-table") || {}).value || "0", 10);
        var total = (sCount * rows * seatsRow) + (tables * seatsTable);
        var el = document.getElementById("mixed-estimate");
        if (el) el.textContent = "Estimated seats: " + (total || 0);
      }

      ["tables-count", "seats-per-table", "table-spacing", "table-rings"].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("input", updateTablesEstimate);
      });
      updateTablesEstimate();

      ["sections-count", "rows-per-section", "seats-per-row", "row-spacing"].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("input", updateSectionsEstimate);
      });
      updateSectionsEstimate();

      ["mixed-sections-count", "mixed-rows-per-section", "mixed-seats-per-row",
       "mixed-tables-count", "mixed-seats-per-table", "mixed-capacity-goal"].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener("input", updateMixedEstimate);
      });
      updateMixedEstimate();

      // "Generate layout" (for now just logs + hides overlay)
      overlay.querySelectorAll("[data-generate-layout]").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var type = btn.getAttribute("data-generate-layout");
          var payload = { type: type, showId: showId };

          if (type === "tables") {
            payload.tables = parseInt((document.getElementById("tables-count") || {}).value || "0", 10);
            payload.seatsPerTable = parseInt((document.getElementById("seats-per-table") || {}).value || "0", 10);
            payload.spacing = parseInt((document.getElementById("table-spacing") || {}).value || "0", 10);
            payload.rings = parseInt((document.getElementById("table-rings") || {}).value || "0", 10);
          } else if (type === "sections") {
            payload.sections = parseInt((document.getElementById("sections-count") || {}).value || "0", 10);
            payload.rowsPerSection = parseInt((document.getElementById("rows-per-section") || {}).value || "0", 10);
            payload.seatsPerRow = parseInt((document.getElementById("seats-per-row") || {}).value || "0", 10);
            payload.rowSpacing = parseInt((document.getElementById("row-spacing") || {}).value || "0", 10);
          } else if (type === "mixed") {
            payload.sections = parseInt((document.getElementById("mixed-sections-count") || {}).value || "0", 10);
            payload.rowsPerSection = parseInt((document.getElementById("mixed-rows-per-section") || {}).value || "0", 10);
            payload.seatsPerRow = parseInt((document.getElementById("mixed-seats-per-row") || {}).value || "0", 10);
            payload.tables = parseInt((document.getElementById("mixed-tables-count") || {}).value || "0", 10);
            payload.seatsPerTable = parseInt((document.getElementById("mixed-seats-per-table") || {}).value || "0", 10);
            payload.capacityGoal = parseInt((document.getElementById("mixed-capacity-goal") || {}).value || "0", 10);
          }

          console.log("[Builder] Generate layout config:", payload);

          // Next iteration: actually draw shapes to the canvas using this config.
          overlay.classList.add("hidden");
          if (canvasPlaceholder) {
            canvasPlaceholder.style.opacity = "0.8";
          }
        });
      });
    })();
  </script>
</body>
</html>
`);
});

export default router;
