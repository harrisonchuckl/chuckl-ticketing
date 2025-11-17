// backend/src/routes/admin-seating-builder.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

type LayoutKey = "tables" | "sections" | "mixed" | "blank";

function normaliseLayout(raw: string | undefined): LayoutKey {
  if (raw === "tables" || raw === "sections" || raw === "mixed" || raw === "blank") {
    return raw;
  }
  return "tables";
}

router.get("/builder/preview/:showId", async (req, res) => {
  const showId = req.params.showId;
  const layout = normaliseLayout(req.query.layout as string | undefined);
  const seatMapId = req.query.seatMapId as string | undefined;

  // NEW: if a template is selected, look it up so we can show a label
  let loadedFromTemplateLabel = "";
  try {
    if (seatMapId) {
      const seatMap = await prisma.seatMap.findUnique({
        where: { id: seatMapId },
        select: { name: true, version: true }
      });
      if (seatMap) {
        loadedFromTemplateLabel = `${seatMap.name} (v${seatMap.version ?? 1})`;
      }
    }
  } catch (err) {
    console.error("seatMap lookup in builder failed", err);
  }

  const fromTemplateChip = loadedFromTemplateLabel
    ? `<div class="header-chip">Loaded from: ${loadedFromTemplateLabel}</div>`
    : "";

  const layoutLabelMap: Record<LayoutKey, string> = {
    tables: "Tables & chairs",
    sections: "Sections & rows",
    mixed: "Mixed seating",
    blank: "Blank canvas",
  };

  const layoutLabel = layoutLabelMap[layout];

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

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="builder-root">
    <header class="builder-header">
      <div class="header-left">
        <div class="step-pill">
          <span class="step-number">3</span>
          <span>Layout details</span>
        </div>
        <div class="builder-title">${layoutLabel}</div>
        <div class="builder-subtitle">
          Configure the room once and reuse this layout for future shows at this venue.
        </div>
      </div>
      <div class="header-right">
        <div class="header-chip">Show ID: ${showId}</div>
        ${fromTemplateChip}
        <button class="header-close" type="button" onclick="window.close && window.close()">
          <span>×</span>
        </button>
      </div>
    </header>

    <main class="builder-shell">
      <aside class="panel">
        <div class="panel-title">Tools</div>
        <div class="tool-list">
          <div class="tool-button">
            <div class="tool-main">
              <div class="tool-emoji">🎭</div>
              <div>
                <div class="tool-label">Stage & focal point</div>
                <div class="tool-meta">Front of room, entrances, bars</div>
              </div>
            </div>
            <span class="tool-badge">Coming soon</span>
          </div>
          <div class="tool-button">
            <div class="tool-main">
              <div class="tool-emoji">🪑</div>
              <div>
                <div class="tool-label">Seat blocks</div>
                <div class="tool-meta">Rows, tables, zones</div>
              </div>
            </div>
            <span class="tool-badge">Coming soon</span>
          </div>
          <div class="tool-button">
            <div class="tool-main">
              <div class="tool-emoji">🎟️</div>
              <div>
                <div class="tool-label">Ticket tiers</div>
                <div class="tool-meta">Link seats to prices</div>
              </div>
            </div>
            <span class="tool-badge">Next</span>
          </div>
        </div>
      </aside>

      <section class="panel">
        <div class="panel-title">Room preview</div>
        <div class="canvas-inner" id="canvas-inner">
          <div class="canvas-overlay-label">
            <span class="dot"></span>
            Live layout preview
          </div>
          <div class="canvas-placeholder" id="canvas-placeholder">
            <div class="canvas-placeholder-inner">
              <h2>Your layout will appear here</h2>
              <p id="preview-summary">
                Adjust the numbers on the right and we'll sketch a layout preview before you save.
              </p>
              <div class="canvas-placeholder-pills">
                <span class="canvas-placeholder-pill">Drag &amp; drop editor coming next</span>
                <span class="canvas-placeholder-pill">Re-use layouts across shows</span>
                <span class="canvas-placeholder-pill">Perfect for comedy, music &amp; cabaret</span>
              </div>
            </div>
          </div>
          <div class="layout-preview" id="layout-preview"></div>
        </div>
      </section>

      <aside class="panel">
        <div class="panel-title">Summary</div>
        <div class="summary-body">
          <div class="summary-row">
            <span class="label">Layout type</span>
            <span class="value" id="summary-layout">${layoutLabel}</span>
          </div>
          <div class="summary-row">
            <span class="label">Estimated capacity</span>
            <span class="value" id="summary-capacity">–</span>
          </div>
          <div class="summary-row">
            <span class="label">Stage & facilities</span>
            <span class="value">Stage + bar + exits</span>
          </div>
          <div class="summary-note">
            This step is just to sketch the room. You'll assign ticket prices to specific seats in the next step.
          </div>
        </div>
        <div class="summary-footer">
          <button class="primary-btn" type="button" id="btn-next">
            Continue to ticket mapping
          </button>
          <button class="ghost-btn" type="button" id="btn-back">
            ← Back to seating style
          </button>
        </div>
      </aside>
    </main>
  </div>

  <!-- Configuration overlay (Step 3 inputs) -->
  <div class="config-overlay" id="config-overlay">
    <div class="config-card">
      <div class="config-header">
        <div class="config-title-block">
          <div class="config-caption">Step 3 of 4</div>
          <div class="config-heading">Tell us about this room</div>
          <div class="config-subtitle" id="config-subtitle">
            We'll use these numbers to sketch the first version of your layout. You can fine-tune it in the editor.
          </div>
        </div>
        <div class="config-chip" id="config-chip">${layoutLabel}</div>
      </div>

      <div class="config-grid" id="config-grid">
        <!-- Fields injected by script -->
      </div>

      <div class="config-footer">
        <div class="config-total">
          Estimated seats: <strong id="config-total-value">–</strong>
        </div>
        <div class="config-actions">
          <button class="ghost-btn" type="button" id="config-cancel">
            Cancel
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
      const layout = ${JSON.stringify(layout)};

      const overlay = document.getElementById("config-overlay");
      const grid = document.getElementById("config-grid");
      const totalSpan = document.getElementById("config-total-value");
      const summaryCapacity = document.getElementById("summary-capacity");
      const previewContainer = document.getElementById("layout-preview");
      const previewSummary = document.getElementById("preview-summary");
      const summaryLayout = document.getElementById("summary-layout");
      const chip = document.getElementById("config-chip");
      const subtitle = document.getElementById("config-subtitle");

      const btnContinue = document.getElementById("config-continue");
      const btnCancel = document.getElementById("config-cancel");
      const btnNext = document.getElementById("btn-next");
      const btnBack = document.getElementById("btn-back");

      const layoutLabels = {
        tables: "Tables & chairs",
        sections: "Sections & rows",
        mixed: "Mixed seating",
        blank: "Blank canvas",
      };

      summaryLayout.textContent = layoutLabels[layout] || layoutLabels.tables;
      chip.textContent = layoutLabels[layout] || layoutLabels.tables;

      if (layout === "blank") {
        if (overlay) overlay.classList.add("hidden");
        if (previewSummary) {
          previewSummary.textContent = "Start from a true blank canvas. Use the editor to place sections, tables and seats exactly where you want them.";
        }
        summaryCapacity.textContent = "Flexible";
        return;
      }

      const fieldDefsByLayout = {
        tables: [
          { key: "numTables", label: "Number of tables", hint: "e.g. 12–30", defaultValue: 16, min: 1 },
          { key: "seatsPerTable", label: "Seats per table", hint: "e.g. 8–12", defaultValue: 8, min: 1 }
        ],
        sections: [
          { key: "numSections", label: "Number of sections", hint: "e.g. stalls, circle, balcony", defaultValue: 3, min: 1 },
          { key: "rowsPerSection", label: "Rows per section", hint: "e.g. 8–20", defaultValue: 10, min: 1 },
          { key: "seatsPerRow", label: "Seats per row", hint: "e.g. 10–30", defaultValue: 16, min: 1 }
        ],
        mixed: [
          { key: "numSections", label: "Number of row sections", hint: "e.g. 2–6", defaultValue: 3, min: 1 },
          { key: "rowsPerSection", label: "Rows per section", hint: "e.g. 5–12", defaultValue: 6, min: 1 },
          { key: "seatsPerRow", label: "Seats per row", hint: "e.g. 10–20", defaultValue: 12, min: 1 },
          { key: "numTables", label: "Number of tables", hint: "e.g. 4–20", defaultValue: 8, min: 0 },
          { key: "seatsPerTable", label: "Seats per table", hint: "e.g. 4–10", defaultValue: 6, min: 0 }
        ]
      };

      const fields = fieldDefsByLayout[layout] || fieldDefsByLayout.tables;

      function renderFields() {
        if (!grid) return;
        grid.innerHTML = "";
        fields.forEach(function (f) {
          const wrapper = document.createElement("div");
          wrapper.className = "field";
          const labelRow = document.createElement("div");
          labelRow.className = "field-label-row";
          const label = document.createElement("div");
          label.className = "field-label";
          label.textContent = f.label;
          const hint = document.createElement("div");
          hint.className = "field-hint";
          hint.textContent = f.hint || "";
          labelRow.appendChild(label);
          wrapper.appendChild(labelRow);
          wrapper.appendChild(hint);
          const input = document.createElement("input");
          input.type = "number";
          input.min = String(f.min ?? 0);
          input.value = String(f.defaultValue ?? 0);
          input.id = "field-" + f.key;
          input.addEventListener("input", updateTotals);
          wrapper.appendChild(input);
          grid.appendChild(wrapper);
        });
      }

      function getValue(id, fallback) {
        const el = document.getElementById("field-" + id);
        if (!el || !(el instanceof HTMLInputElement)) return fallback;
        const n = parseInt(el.value, 10);
        if (isNaN(n) || n < 0) return fallback;
        return n;
      }

      function updateTotals() {
        let total = 0;

        if (layout === "tables") {
          const t = getValue("numTables", 0);
          const s = getValue("seatsPerTable", 0);
          total = t * s;
        } else if (layout === "sections") {
          const sec = getValue("numSections", 0);
          const rows = getValue("rowsPerSection", 0);
          const per = getValue("seatsPerRow", 0);
          total = sec * rows * per;
        } else if (layout === "mixed") {
          const sec2 = getValue("numSections", 0);
          const rows2 = getValue("rowsPerSection", 0);
          const per2 = getValue("seatsPerRow", 0);
          const t2 = getValue("numTables", 0);
          const s2 = getValue("seatsPerTable", 0);
          total = sec2 * rows2 * per2 + t2 * s2;
        }

        totalSpan.textContent = total > 0 ? String(total) : "–";
        summaryCapacity.textContent = total > 0 ? String(total) : "TBC";
        drawPreview(total);
      }

      function drawPreview(totalSeats) {
        previewContainer.innerHTML = "";
        if (totalSeats <= 0) return;

        if (layout === "tables" || layout === "mixed") {
          const numTables = getValue("numTables", 0);
          const seatsPerTable = getValue("seatsPerTable", 0);
          if (numTables > 0 && seatsPerTable > 0) {
            const group = document.createElement("div");
            group.className = layout === "mixed" ? "mixed-group" : "table-group";
            const label = document.createElement("div");
            label.className = "layout-group-label";
            label.textContent = layout === "mixed" ? "Table zones" : "Cabaret tables";
            group.appendChild(label);

            for (let i = 0; i < Math.min(numTables, 6); i++) {
              const row = document.createElement("div");
              row.className = "seats-row";
              for (let j = 0; j < Math.min(seatsPerTable, 10); j++) {
                const dot = document.createElement("div");
                dot.className = "seat-dot";
                if (j === 0) dot.classList.add("seat-dot--primary");
                row.appendChild(dot);
              }
              group.appendChild(row);
            }
            previewContainer.appendChild(group);
          }
        }

        if (layout === "sections" || layout === "mixed") {
          const numSections = getValue("numSections", 0);
          const rows = getValue("rowsPerSection", 0);
          const perRow = getValue("seatsPerRow", 0);
          if (numSections > 0 && rows > 0 && perRow > 0) {
            const group2 = document.createElement("div");
            group2.className = layout === "mixed" ? "mixed-group" : "row-group";
            const label2 = document.createElement("div");
            label2.className = "layout-group-label";
            label2.textContent = layout === "mixed" ? "Row sections" : "Theatre rows";
            group2.appendChild(label2);

            for (let r = 0; r < Math.min(rows, 6); r++) {
              const row2 = document.createElement("div");
              row2.className = "seats-row";
              for (let c = 0; c < Math.min(perRow, 18); c++) {
                const dot2 = document.createElement("div");
                dot2.className = "seat-dot";
                if (c === 0 && r === 0) dot2.classList.add("seat-dot--primary");
                row2.appendChild(dot2);
              }
              group2.appendChild(row2);
            }
            previewContainer.appendChild(group2);
          }
        }

        if (previewSummary) {
          previewSummary.textContent =
            "This is a visual sketch only. The next version of the editor will let you drag, rotate and fine-tune every block.";
        }
      }

      renderFields();
      updateTotals();

      btnContinue.addEventListener("click", () => {
        overlay.classList.add("hidden");
      });

      btnCancel.addEventListener("click", () => {
        overlay.classList.add("hidden");
      });

      btnBack.addEventListener("click", () => {
        window.history.back();
      });

      btnNext.addEventListener("click", () => {
        alert("Next up: we'll plug this into the interactive seat-by-seat editor and ticket mapping.");
      });

      if (layout === "tables") {
        subtitle.textContent = "Perfect for comedy clubs, cabaret and gala dinners. Set your table counts once, then reuse them.";
      } else if (layout === "sections") {
        subtitle.textContent = "Classic theatre style. We'll sketch sections and rows so you can tweak them in the editor.";
      } else if (layout === "mixed") {
        subtitle.textContent = "Blend reserved rows with cabaret tables – ideal for flexible spaces and premium zones.";
      }
    })();
  </script>
</body>
</html>`;

  res.status(200).send(html);
});

export default router;