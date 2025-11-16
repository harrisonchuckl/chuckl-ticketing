// backend/src/routes/admin-seating-builder.ts
import { Router } from "express";

const router = Router();

type LayoutKey = "tables" | "sections" | "mixed" | "blank";

function normaliseLayout(raw: string | undefined): LayoutKey {
  if (raw === "sections" || raw === "mixed" || raw === "blank") return raw;
  return "tables";
}

router.get("/builder/preview/:showId", (req, res) => {
  const showId = req.params.showId;
  const layout = normaliseLayout(req.query.layout as string | undefined);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Seat map builder – TickIn</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      --bg: #f3f5fb;
      --card-bg: #ffffff;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.12);
      --accent-strong: rgba(37, 99, 235, 0.18);
      --border-subtle: rgba(15, 23, 42, 0.06);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --pill-bg: #e2e8f0;
      --pill-text: #475569;
      --radius-lg: 22px;
      --radius-xl: 26px;
      --shadow-soft: 0 18px 45px rgba(15, 23, 42, 0.12);
      --shadow-card: 0 12px 30px rgba(15, 23, 42, 0.08);
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
        "Segoe UI", sans-serif;
      color: var(--text-main);
      background: radial-gradient(circle at top left, #e0ecff, #f6f7fc 44%, #eef1ff 85%);
    }

    body {
      display: flex;
      align-items: stretch;
      justify-content: center;
    }

    .builder-root {
      width: 100%;
      max-width: 1440px;
      margin: 18px auto;
      padding: 16px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-radius: 28px;
      background: linear-gradient(145deg, #f9f9ff, #f2f5ff);
      box-shadow: var(--shadow-soft);
    }

    /* Header / steps */

    .builder-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
    }

    .step-pill span.step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      font-weight: 600;
      font-size: 10px;
    }

    .builder-title {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .builder-subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-chip {
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.15);
      color: #475569;
    }

    .header-close {
      border-radius: 999px;
      border: 0;
      background: white;
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.1);
      cursor: pointer;
    }

    .header-close span {
      font-size: 17px;
      line-height: 1;
    }

    .header-close:hover {
      transform: translateY(-1px);
    }

    /* Shell layout */

    .builder-shell {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr) 260px;
      gap: 16px;
      height: calc(100vh - 120px);
      min-height: 520px;
    }

    .panel {
      border-radius: var(--radius-lg);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: var(--shadow-card);
      padding: 16px 16px 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    /* Left tools */

    .tool-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    .tool-button {
      border-radius: 999px;
      border: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 10px;
      font-size: 12px;
      background: rgba(148, 163, 184, 0.06);
      color: var(--text-main);
      cursor: default;
    }

    .tool-main {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .tool-emoji {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
      font-size: 14px;
    }

    .tool-label {
      font-weight: 500;
      letter-spacing: -0.01em;
    }

    .tool-meta {
      font-size: 10px;
      color: var(--text-muted);
    }

    .tool-badge {
      font-size: 10px;
      padding: 3px 7px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.06);
      color: var(--accent);
    }

    /* Canvas */

    .canvas-inner {
      position: relative;
      flex: 1;
      border-radius: 18px;
      background-image: linear-gradient(
          to right,
          rgba(148, 163, 184, 0.16) 1px,
          transparent 1px
        ),
        linear-gradient(
          to bottom,
          rgba(148, 163, 184, 0.16) 1px,
          transparent 1px
        );
      background-size: 32px 32px;
      background-position: center;
      overflow: hidden;
    }

    .canvas-overlay-label {
      position: absolute;
      top: 10px;
      left: 12px;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      color: white;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .canvas-overlay-label span.dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #22c55e;
    }

    .canvas-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .canvas-placeholder-inner {
      padding: 14px 18px;
      border-radius: 18px;
      background: rgba(248, 250, 252, 0.96);
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
      text-align: left;
      max-width: 360px;
    }

    .canvas-placeholder-inner h2 {
      font-size: 15px;
      margin: 0 0 4px;
    }

    .canvas-placeholder-inner p {
      font-size: 12px;
      margin: 0 0 10px;
      color: var(--text-muted);
    }

    .canvas-placeholder-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .canvas-placeholder-pill {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(148, 163, 184, 0.16);
      color: #475569;
    }

    /* Generated layout preview */

    .layout-preview {
      position: absolute;
      inset: 54px 28px 24px 28px;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 16px;
      overflow: auto;
      padding: 4px;
    }

    .layout-group-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .table-group,
    .row-group,
    .mixed-group {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.03);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.10);
    }

    .seats-row {
      display: flex;
      gap: 4px;
    }

    .seat-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: white;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.25);
    }

    .seat-dot--primary {
      background: var(--accent);
    }

    /* Right summary */

    .summary-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }

    .summary-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 10px;
      background: rgba(148, 163, 184, 0.07);
    }

    .summary-row span.label {
      color: var(--text-muted);
    }

    .summary-row span.value {
      font-weight: 500;
    }

    .summary-note {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .summary-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .primary-btn {
      border-radius: 999px;
      border: 0;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 500;
      background: var(--accent);
      color: white;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 10px 24px var(--accent-strong);
    }

    .primary-btn:hover {
      filter: brightness(1.03);
      transform: translateY(-0.5px);
    }

    .ghost-btn {
      border-radius: 999px;
      border: 0;
      padding: 8px 12px;
      font-size: 12px;
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }

    /* Config overlay (Step 3) */

    .config-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.30), rgba(15, 23, 42, 0.58));
      z-index: 10;
    }

    .config-card {
      width: 480px;
      max-width: 92vw;
      border-radius: var(--radius-xl);
      background: rgba(248, 250, 252, 0.98);
      box-shadow: 0 26px 60px rgba(15, 23, 42, 0.4);
      padding: 18px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .config-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .config-title-block {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .config-caption {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(148, 163, 184, 1);
    }

    .config-heading {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .config-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      max-width: 280px;
    }

    .config-chip {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(148, 163, 184, 0.14);
      color: #475569;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 14px;
      margin-top: 4px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .field-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }

    .field-label {
      font-weight: 500;
    }

    .field-hint {
      font-size: 10px;
      color: var(--text-muted);
    }

    .field input[type="number"] {
      border-radius: 11px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      padding: 7px 9px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
    }

    .field input[type="number"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent-soft);
    }

    .config-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 6px;
    }

    .config-total {
      font-size: 12px;
      color: var(--text-muted);
    }

    .config-total strong {
      color: var(--text-main);
    }

    .config-actions {
      display: flex;
      gap: 8px;
    }

    .config-actions .primary-btn {
      padding-inline: 16px;
    }

    .hidden {
      display: none !important;
    }

    /* Tiny responsive tweak */
    @media (max-width: 1100px) {
      .builder-shell {
        grid-template-columns: 200px minmax(0, 1fr);
      }
      .panel--right {
        display: none;
      }
    }

    @media (max-width: 900px) {
      .builder-root {
        margin: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .builder-shell {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto auto;
        height: auto;
      }
      .panel--left {
        order: 2;
        flex-direction: row;
        overflow-x: auto;
      }
      .tool-list {
        flex-direction: row;
      }
    }
  </style>
</head>
<body>
  <div class="builder-root">
    <header class="builder-header">
      <div class="header-left">
        <div class="step-pill">
          <span class="step-number" id="step-pill-number">3</span>
          <span id="step-pill-label">Layout details</span>
        </div>
        <div class="builder-title" id="builder-title">Seat map builder</div>
        <div class="builder-subtitle" id="builder-subtitle">
          Tune the size of the room, then we’ll auto-create a layout you can refine.
        </div>
      </div>
      <div class="header-right">
        <div class="header-chip" id="layout-chip">Starting from: tables & chairs</div>
        <button class="header-close" type="button" onclick="window.history.back()">
          <span>✕</span>
        </button>
      </div>
    </header>

    <section class="builder-shell">
      <!-- Left tools -->
      <aside class="panel panel--left">
        <div class="panel-title">Tools</div>
        <div class="tool-list">
          <button class="tool-button" type="button">
            <div class="tool-main">
              <span class="tool-emoji">🎭</span>
              <div>
                <div class="tool-label">Stage & zones</div>
                <div class="tool-meta">Define where the action happens</div>
              </div>
            </div>
            <span class="tool-badge">Soon</span>
          </button>
          <button class="tool-button" type="button">
            <div class="tool-main">
              <span class="tool-emoji">🪑</span>
              <div>
                <div class="tool-label">Seating blocks</div>
                <div class="tool-meta">Tables, rows & hybrids</div>
              </div>
            </div>
            <span class="tool-badge">Soon</span>
          </button>
          <button class="tool-button" type="button">
            <div class="tool-main">
              <span class="tool-emoji">🚪</span>
              <div>
                <div class="tool-label">Objects</div>
                <div class="tool-meta">Bars, doors, aisles</div>
              </div>
            </div>
            <span class="tool-badge">Soon</span>
          </button>
        </div>
      </aside>

      <!-- Canvas -->
      <main class="panel panel--center">
        <div class="canvas-inner" id="canvas">
          <div class="canvas-overlay-label">
            <span class="dot"></span>
            <span id="canvas-label-text">Preview only – layout not saved yet</span>
          </div>

          <div class="canvas-placeholder" id="canvas-placeholder">
            <div class="canvas-placeholder-inner">
              <h2 id="placeholder-heading">We’ll build this room for you</h2>
              <p id="placeholder-text">
                Adjust the numbers on the right, then hit <strong>Continue</strong>. We’ll auto-create a
                starter layout you can tweak, rather than dragging every seat by hand.
              </p>
              <div class="canvas-placeholder-pills">
                <span class="canvas-placeholder-pill">Auto-generated seats</span>
                <span class="canvas-placeholder-pill">Perfect for quick setups</span>
                <span class="canvas-placeholder-pill">Edit everything later</span>
              </div>
            </div>
          </div>

          <div class="layout-preview" id="layout-preview"></div>
        </div>
      </main>

      <!-- Right summary / config mirror -->
      <aside class="panel panel--right">
        <div class="panel-title">Summary</div>
        <div class="summary-body">
          <div class="summary-row">
            <span class="label">Layout type</span>
            <span class="value" id="summary-layout">Tables & chairs</span>
          </div>
          <div class="summary-row" id="summary-row-sections">
            <span class="label">Sections</span>
            <span class="value" id="summary-sections">–</span>
          </div>
          <div class="summary-row" id="summary-row-rows">
            <span class="label">Rows per section</span>
            <span class="value" id="summary-rows">–</span>
          </div>
          <div class="summary-row" id="summary-row-seats-per-row">
            <span class="label">Seats per row</span>
            <span class="value" id="summary-seats-per-row">–</span>
          </div>
          <div class="summary-row" id="summary-row-tables">
            <span class="label">Tables</span>
            <span class="value" id="summary-tables">–</span>
          </div>
          <div class="summary-row" id="summary-row-seats-per-table">
            <span class="label">Seats per table</span>
            <span class="value" id="summary-seats-per-table">–</span>
          </div>
          <div class="summary-row">
            <span class="label">Estimated seats</span>
            <span class="value" id="summary-total">0</span>
          </div>
          <div class="summary-note">
            This is a quick estimate based on your starter settings. You’ll still be able to nudge,
            resize and refine the layout seat-by-seat in the final builder.
          </div>
        </div>
        <div class="summary-footer">
          <button class="primary-btn" type="button" id="summary-continue">
            Continue to seat map
          </button>
          <button class="ghost-btn" type="button" onclick="window.history.back()">
            Back to layout style
          </button>
        </div>
      </aside>
    </section>
  </div>

  <!-- Config overlay (Step 3 of 4) -->
  <div class="config-overlay" id="config-overlay">
    <div class="config-card">
      <div class="config-header">
        <div class="config-title-block">
          <div class="config-caption">Step 3 of 4 · Layout details</div>
          <div class="config-heading" id="config-heading">Tables & chairs</div>
          <div class="config-subtitle" id="config-subtitle">
            Tell us how big this room is and we’ll auto-create tables and seats for you.
          </div>
        </div>
        <div class="config-chip" id="config-chip">Quick starter</div>
      </div>

      <div class="config-grid">
        <!-- Sections (for sections & rows / mixed) -->
        <div class="field" data-layouts="sections,mixed">
          <div class="field-label-row">
            <span class="field-label">Number of sections</span>
            <span class="field-hint">Stalls, circle, balcony…</span>
          </div>
          <input type="number" id="field-sections" min="1" max="40" value="3" />
        </div>

        <div class="field" data-layouts="sections,mixed">
          <div class="field-label-row">
            <span class="field-label">Rows per section</span>
            <span class="field-hint">Front to back</span>
          </div>
          <input type="number" id="field-rows" min="1" max="80" value="8" />
        </div>

        <div class="field" data-layouts="sections,mixed">
          <div class="field-label-row">
            <span class="field-label">Seats per row</span>
            <span class="field-hint">Left to right</span>
          </div>
          <input type="number" id="field-seats-per-row" min="1" max="80" value="16" />
        </div>

        <!-- Tables (for tables / mixed) -->
        <div class="field" data-layouts="tables,mixed">
          <div class="field-label-row">
            <span class="field-label">Number of tables</span>
            <span class="field-hint">Round or long</span>
          </div>
          <input type="number" id="field-tables" min="1" max="120" value="12" />
        </div>

        <div class="field" data-layouts="tables,mixed">
          <div class="field-label-row">
            <span class="field-label">Seats per table</span>
            <span class="field-hint">Per cabaret table</span>
          </div>
          <input type="number" id="field-seats-per-table" min="1" max="20" value="8" />
        </div>
      </div>

      <div class="config-footer">
        <div class="config-total">
          Estimated seats: <strong id="config-total">0</strong>
        </div>
        <div class="config-actions">
          <button class="ghost-btn" type="button" id="config-skip">
            Skip for now
          </button>
          <button class="primary-btn" type="button" id="config-continue">
            Continue
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var showId = "${showId}";
      var initialLayout = "${layout}"; // "tables" | "sections" | "mixed" | "blank"

      // --- Shared state ---
      var state = {
        layout: initialLayout,
        sections: 3,
        rowsPerSection: 8,
        seatsPerRow: 16,
        tables: 12,
        seatsPerTable: 8
      };

      // Elements
      var overlay = document.getElementById("config-overlay");
      var layoutChip = document.getElementById("layout-chip");
      var builderTitle = document.getElementById("builder-title");
      var builderSubtitle = document.getElementById("builder-subtitle");
      var stepNumber = document.getElementById("step-pill-number");
      var stepLabel = document.getElementById("step-pill-label");

      var configHeading = document.getElementById("config-heading");
      var configSubtitle = document.getElementById("config-subtitle");
      var configChip = document.getElementById("config-chip");
      var configTotal = document.getElementById("config-total");

      var fieldSections = document.getElementById("field-sections");
      var fieldRows = document.getElementById("field-rows");
      var fieldSeatsPerRow = document.getElementById("field-seats-per-row");
      var fieldTables = document.getElementById("field-tables");
      var fieldSeatsPerTable = document.getElementById("field-seats-per-table");

      var summaryLayout = document.getElementById("summary-layout");
      var summarySections = document.getElementById("summary-sections");
      var summaryRows = document.getElementById("summary-rows");
      var summarySeatsPerRow = document.getElementById("summary-seats-per-row");
      var summaryTables = document.getElementById("summary-tables");
      var summarySeatsPerTable = document.getElementById("summary-seats-per-table");
      var summaryTotal = document.getElementById("summary-total");
      var summaryContinue = document.getElementById("summary-continue");
      var summaryRowSections = document.getElementById("summary-row-sections");
      var summaryRowRows = document.getElementById("summary-row-rows");
      var summaryRowSeatsPerRow = document.getElementById("summary-row-seats-per-row");
      var summaryRowTables = document.getElementById("summary-row-tables");
      var summaryRowSeatsPerTable = document.getElementById("summary-row-seats-per-table");

      var canvasPlaceholder = document.getElementById("canvas-placeholder");
      var layoutPreview = document.getElementById("layout-preview");

      var configContinue = document.getElementById("config-continue");
      var configSkip = document.getElementById("config-skip");

      // --- Layout-specific copy ---

      function layoutLabel(layout) {
        if (layout === "sections") return "Sections & rows";
        if (layout === "mixed") return "Mixed seating";
        if (layout === "blank") return "Blank canvas";
        return "Tables & chairs";
      }

      function applyLayoutCopy(layout) {
        var label = layoutLabel(layout);
        layoutChip.textContent = "Starting from: " + label;
        summaryLayout.textContent = label;

        if (layout === "blank") {
          builderTitle.textContent = "Blank canvas builder";
          builderSubtitle.textContent =
            "Start with a clean grid, then drop in sections, rows and tables exactly where you want them.";
        } else {
          builderTitle.textContent = "Seat map builder";
          builderSubtitle.textContent =
            "Set the basics for this room, then refine the auto-generated layout in the builder.";
        }

        configHeading.textContent = label;

        if (layout === "tables") {
          configSubtitle.textContent =
            "Cabaret-style maps with round or long tables and seats auto-generated around them.";
          configChip.textContent = "Cabaret rooms";
        } else if (layout === "sections") {
          configSubtitle.textContent =
            "Classic theatre blocks with aisles, numbered rows and fixed seating.";
          configChip.textContent = "Theatre style";
        } else if (layout === "mixed") {
          configSubtitle.textContent =
            "Blend tables, rows and standing zones in one flexible map.";
          configChip.textContent = "Hybrid layouts";
        }
      }

      // Show/hide config fields depending on layout

      function refreshFieldVisibility(layout) {
        var fields = document.querySelectorAll(".field");
        fields.forEach(function (el) {
          var layouts = el.getAttribute("data-layouts");
          if (!layouts) return;
          var list = layouts.split(",");
          if (list.indexOf(layout) !== -1) {
            el.classList.remove("hidden");
          } else {
            el.classList.add("hidden");
          }
        });

        // Summary rows visibility
        var hasSections = layout === "sections" || layout === "mixed";
        var hasTables = layout === "tables" || layout === "mixed";

        summaryRowSections.style.display = hasSections ? "flex" : "none";
        summaryRowRows.style.display = hasSections ? "flex" : "none";
        summaryRowSeatsPerRow.style.display = hasSections ? "flex" : "none";

        summaryRowTables.style.display = hasTables ? "flex" : "none";
        summaryRowSeatsPerTable.style.display = hasTables ? "flex" : "none";
      }

      // --- Numbers + totals ---

      function safeNumber(input, fallback) {
        var v = parseInt(input.value, 10);
        if (isNaN(v) || v <= 0) return fallback;
        return v;
      }

      function syncStateFromInputs() {
        state.sections = safeNumber(fieldSections, state.sections);
        state.rowsPerSection = safeNumber(fieldRows, state.rowsPerSection);
        state.seatsPerRow = safeNumber(fieldSeatsPerRow, state.seatsPerRow);
        state.tables = safeNumber(fieldTables, state.tables);
        state.seatsPerTable = safeNumber(fieldSeatsPerTable, state.seatsPerTable);
      }

      function computeTotal(layout) {
        var total = 0;
        if (layout === "tables") {
          total = state.tables * state.seatsPerTable;
        } else if (layout === "sections") {
          total = state.sections * state.rowsPerSection * state.seatsPerRow;
        } else if (layout === "mixed") {
          var theatre = state.sections * state.rowsPerSection * state.seatsPerRow;
          var cabaret = state.tables * state.seatsPerTable;
          total = theatre + cabaret;
        } else {
          total = 0;
        }
        return total;
      }

      function refreshTotals() {
        var total = computeTotal(state.layout);
        configTotal.textContent = String(total);
        summaryTotal.textContent = String(total);

        summarySections.textContent = String(state.sections);
        summaryRows.textContent = String(state.rowsPerSection);
        summarySeatsPerRow.textContent = String(state.seatsPerRow);
        summaryTables.textContent = String(state.tables);
        summarySeatsPerTable.textContent = String(state.seatsPerTable);
      }

      // --- Generate visual preview on canvas ---

      function clearPreview() {
        layoutPreview.innerHTML = "";
      }

      function createSeatDot(primary) {
        var seat = document.createElement("div");
        seat.className = primary ? "seat-dot seat-dot--primary" : "seat-dot";
        return seat;
      }

      function renderTablesPreview() {
        var groupLabel = document.createElement("div");
        groupLabel.className = "layout-group-label";
        groupLabel.textContent = "Auto-generated tables";
        layoutPreview.appendChild(groupLabel);

        for (var t = 0; t < state.tables; t++) {
          var group = document.createElement("div");
          group.className = "table-group";

          var seatsRow = document.createElement("div");
          seatsRow.className = "seats-row";

          for (var s = 0; s < state.seatsPerTable; s++) {
            var primary = s === 0;
            seatsRow.appendChild(createSeatDot(primary));
          }

          group.appendChild(seatsRow);
          layoutPreview.appendChild(group);
        }
      }

      function renderSectionsPreview() {
        var label = document.createElement("div");
        label.className = "layout-group-label";
        label.textContent = "Auto-generated rows";
        layoutPreview.appendChild(label);

        for (var section = 0; section < state.sections; section++) {
          var group = document.createElement("div");
          group.className = "row-group";

          for (var r = 0; r < state.rowsPerSection; r++) {
            var row = document.createElement("div");
            row.className = "seats-row";
            for (var s = 0; s < state.seatsPerRow; s++) {
              var primary = r === 0 && (s === 0 || s === state.seatsPerRow - 1);
              row.appendChild(createSeatDot(primary));
            }
            group.appendChild(row);
          }

          layoutPreview.appendChild(group);
        }
      }

      function renderMixedPreview() {
        var label = document.createElement("div");
        label.className = "layout-group-label";
        label.textContent = "Hybrid layout";
        layoutPreview.appendChild(label);

        var hybrid = document.createElement("div");
        hybrid.className = "mixed-group";

        // Top: a few rows
        for (var r = 0; r < Math.min(state.rowsPerSection, 4); r++) {
          var row = document.createElement("div");
          row.className = "seats-row";
          for (var s = 0; s < Math.min(state.seatsPerRow, 14); s++) {
            var primary = r === 0 && (s === 0 || s === Math.min(state.seatsPerRow, 14) - 1);
            row.appendChild(createSeatDot(primary));
          }
          hybrid.appendChild(row);
        }

        // Bottom: a few tables
        var tablesRow = document.createElement("div");
        tablesRow.className = "seats-row";
        for (var t = 0; t < Math.min(state.tables, 6); t++) {
          var tbl = document.createElement("div");
          tbl.className = "seat-dot seat-dot--primary";
          tablesRow.appendChild(tbl);
        }
        hybrid.appendChild(tablesRow);

        layoutPreview.appendChild(hybrid);
      }

      function renderBlankPreview() {
        var label = document.createElement("div");
        label.className = "layout-group-label";
        label.textContent = "Blank canvas";
        layoutPreview.appendChild(label);
      }

      function generatePreview() {
        clearPreview();

        if (state.layout === "tables") {
          renderTablesPreview();
        } else if (state.layout === "sections") {
          renderSectionsPreview();
        } else if (state.layout === "mixed") {
          renderMixedPreview();
        } else {
          renderBlankPreview();
        }
      }

      // --- Config overlay control ---

      function enterStep3() {
        if (state.layout === "blank") {
          // No overlay – go straight to builder
          overlay.classList.add("hidden");
          canvasPlaceholder.classList.remove("hidden");
          stepNumber.textContent = "4";
          stepLabel.textContent = "Seat map builder";
          generatePreview();
          return;
        }

        overlay.classList.remove("hidden");
        stepNumber.textContent = "3";
        stepLabel.textContent = "Layout details";

        applyLayoutCopy(state.layout);
        refreshFieldVisibility(state.layout);
        refreshTotals();
      }

      function goToStep4() {
        overlay.classList.add("hidden");
        canvasPlaceholder.classList.add("hidden");
        stepNumber.textContent = "4";
        stepLabel.textContent = "Seat map builder";
        generatePreview();
      }

      // Input events
      [fieldSections, fieldRows, fieldSeatsPerRow, fieldTables, fieldSeatsPerTable].forEach(
        function (input) {
          input.addEventListener("input", function () {
            syncStateFromInputs();
            refreshTotals();
          });
        }
      );

      configContinue.addEventListener("click", function () {
        syncStateFromInputs();
        refreshTotals();
        goToStep4();
      });

      configSkip.addEventListener("click", function () {
        goToStep4();
      });

      summaryContinue.addEventListener("click", function () {
        // Later: POST config + layout to backend to create a real seat map record
        // For now we just log – this keeps the flow visual and non-breaking.
        console.log("Seat map config for show " + showId + ":", state);
        alert(
          "This is the visual preview step only for now. " +
          "Next iteration we will wire this to actually save seat maps in the database."
        );
      });

      // --- Initialise ---

      applyLayoutCopy(state.layout);
      refreshFieldVisibility(state.layout);
      refreshTotals();
      enterStep3();
    })();
  </script>
</body>
</html>`;

  res.status(200).send(html);
});

export default router;
