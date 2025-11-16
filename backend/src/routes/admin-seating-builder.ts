import { Router } from "express";

const router = Router();

router.get("/seating/builder/preview/:showId", (req, res) => {
  const { showId } = req.params;
  const layoutParam = typeof req.query.layout === "string" ? req.query.layout : "tables";

  const layoutKey = ["tables", "sections", "mixed", "blank"].includes(layoutParam)
    ? layoutParam
    : "tables";

  const layoutTitleMap: Record<string, string> = {
    tables: "Tables & chairs",
    sections: "Sections & rows",
    mixed: "Mixed seating",
    blank: "Blank canvas",
  };

  const layoutSubtitleMap: Record<string, string> = {
    tables: "Cabaret-style maps with round or long tables.",
    sections: "Classic theatre blocks with aisles and fixed seating.",
    mixed: "Blend tables, rows and standing zones in one map.",
    blank: "Start from an empty room and add only what you need.",
  };

  const layoutTitle = layoutTitleMap[layoutKey] || layoutTitleMap.tables;
  const layoutSubtitle = layoutSubtitleMap[layoutKey] || layoutSubtitleMap.tables;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Design layout – TickIn Admin</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      --bg-soft: #f5f7ff;
      --bg-strong: #0f172a;
      --card-border: #e2e8f0;
      --accent: #2563eb;
      --accent-soft: #dbeafe;
      --accent-strong: #1d4ed8;
      --text-main: #0f172a;
      --text-muted: #6b7280;
      --radius-lg: 22px;
      --radius-md: 14px;
      --radius-pill: 999px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Helvetica Neue", Arial, sans-serif;
      color: var(--text-main);
      background:
        radial-gradient(circle at top left, #eef2ff 0, transparent 55%),
        radial-gradient(circle at bottom right, #e0f2fe 0, transparent 55%),
        #f9fafb;
    }

    body {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .page {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .top-bar {
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      backdrop-filter: blur(16px);
      background: rgba(248, 250, 252, 0.9);
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .top-inner {
      width: 100%;
      max-width: 1240px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .top-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .step-pill {
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.55);
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      background: rgba(255, 255, 255, 0.9);
    }

    .top-title {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
    }

    .badge-layout {
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: rgba(219, 234, 254, 0.9);
      border: 1px solid rgba(129, 140, 248, 0.4);
      font-size: 12px;
      color: #1e3a8a;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .badge-layout span.icon {
      font-size: 14px;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ghost-btn {
      border-radius: var(--radius-pill);
      padding: 6px 12px;
      font-size: 13px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.7);
      color: #4b5563;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease,
        transform 0.18s ease, box-shadow 0.18s ease;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    }

    .ghost-btn:hover {
      background: #ffffff;
      border-color: var(--accent);
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
    }

    .ghost-btn span.icon {
      font-size: 14px;
    }

    .primary-btn {
      border-radius: var(--radius-pill);
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      color: #f9fafb;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 16px 35px rgba(37, 99, 235, 0.4);
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
      text-decoration: none;
    }

    .primary-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 20px 45px rgba(37, 99, 235, 0.5);
      filter: brightness(1.03);
    }

    .primary-btn span.icon {
      font-size: 14px;
    }

    .builder-shell {
      flex: 1;
      display: flex;
      justify-content: center;
      padding: 20px;
    }

    .builder-inner {
      width: 100%;
      max-width: 1240px;
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(260px, 1fr);
      gap: 20px;
      align-items: stretch;
    }

    @media (max-width: 1024px) {
      .builder-inner {
        grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr);
      }
    }

    @media (max-width: 820px) {
      .builder-inner {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .canvas-card {
      position: relative;
      border-radius: 26px;
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), transparent 55%),
        radial-gradient(circle at bottom right, rgba(191, 219, 254, 0.95), transparent 60%),
        #111827;
      box-shadow: 0 22px 60px rgba(15, 23, 42, 0.55);
      padding: 18px 18px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }

    .canvas-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .canvas-header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: #e5e7eb;
    }

    .canvas-title {
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      opacity: 0.9;
    }

    .canvas-subtitle {
      font-size: 13px;
      color: #9ca3af;
    }

    .scale-pill {
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.5);
      font-size: 11px;
      color: #e5e7eb;
      background: rgba(15, 23, 42, 0.7);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .canvas-body {
      position: relative;
      flex: 1;
      margin-top: 6px;
      border-radius: 22px;
      overflow: hidden;
      background:
        radial-gradient(circle at top center, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 1));
      border: 1px solid rgba(148, 163, 184, 0.4);
      display: flex;
      flex-direction: column;
    }

    .canvas-toolbar {
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      background: linear-gradient(
        to right,
        rgba(15, 23, 42, 0.98),
        rgba(15, 23, 42, 0.9)
      );
      border-bottom: 1px solid rgba(31, 41, 55, 0.9);
      color: #e5e7eb;
      font-size: 11px;
    }

    .canvas-toolbar-left,
    .canvas-toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .toolbar-pill {
      padding: 4px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(75, 85, 99, 0.9);
      background: rgba(15, 23, 42, 0.9);
      font-size: 11px;
      color: #e5e7eb;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .toolbar-pill span.icon {
      font-size: 12px;
    }

    .toolbar-divider {
      width: 1px;
      height: 18px;
      background: rgba(75, 85, 99, 0.85);
    }

    .canvas-main {
      flex: 1;
      position: relative;
      padding: 18px 20px;
      color: #e5e7eb;
      overflow: hidden;
    }

    .grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(31, 41, 55, 0.7) 1px, transparent 1px),
        linear-gradient(90deg, rgba(31, 41, 55, 0.7) 1px, transparent 1px);
      background-size: 32px 32px;
      opacity: 0.35;
      pointer-events: none;
    }

    .stage {
      position: absolute;
      left: 50%;
      top: 34px;
      transform: translateX(-50%);
      padding: 6px 18px;
      border-radius: 999px;
      background: linear-gradient(to bottom, #fef9c3, #facc15);
      color: #422006;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      box-shadow: 0 10px 26px rgba(251, 191, 36, 0.7);
    }

    .seating-rows {
      position: absolute;
      inset: 86px 32px auto 32px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .row {
      display: flex;
      gap: 8px;
      justify-content: center;
    }

    .seat {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      background: radial-gradient(circle at 30% 20%, #93c5fd, #1d4ed8);
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.8);
    }

    .table-zone {
      position: absolute;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 30px;
    }

    .table {
      width: 54px;
      height: 54px;
      border-radius: 999px;
      background: radial-gradient(circle at 30% 20%, #fed7aa, #f97316);
      box-shadow: 0 10px 24px rgba(248, 113, 22, 0.7);
      position: relative;
    }

    .table::before,
    .table::after {
      content: "";
      position: absolute;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #0f172a;
      border: 2px solid #e5e7eb;
    }

    .table::before {
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
    }

    .table::after {
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
    }

    .table-seat-left,
    .table-seat-right {
      position: absolute;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #0f172a;
      border: 2px solid #e5e7eb;
    }

    .table-seat-left {
      left: -8px;
      top: 50%;
      transform: translateY(-50%);
    }

    .table-seat-right {
      right: -8px;
      top: 50%;
      transform: translateY(-50%);
    }

    .canvas-hint {
      position: absolute;
      right: 20px;
      bottom: 18px;
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      background: rgba(15, 23, 42, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.6);
      font-size: 11px;
      color: #e5e7eb;
      display: inline-flex;
      gap: 8px;
      align-items: center;
      backdrop-filter: blur(12px);
    }

    .canvas-hint span.key {
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.9);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 10px;
    }

    /* Right-hand tools panel */

    .tools-card {
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
      border: 1px solid rgba(209, 213, 219, 0.95);
      padding: 16px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .tools-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .tools-eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #9ca3af;
      font-weight: 600;
    }

    .tools-title {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #111827;
    }

    .tools-subtitle {
      font-size: 12px;
      color: var(--text-muted);
    }

    .tool-section {
      margin-top: 4px;
      padding-top: 8px;
      border-top: 1px dashed rgba(209, 213, 219, 0.9);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tool-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 12px;
      background: #f9fafb;
      border: 1px solid rgba(229, 231, 235, 1);
    }

    .tool-main {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tool-icon {
      width: 26px;
      height: 26px;
      border-radius: 9px;
      background: #e0f2fe;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .tool-label {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .tool-label-title {
      font-size: 13px;
      font-weight: 500;
      color: #111827;
    }

    .tool-label-sub {
      font-size: 11px;
      color: #6b7280;
    }

    .tool-chip {
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.6);
      font-size: 10px;
      color: #4b5563;
      background: #f3f4f6;
    }

    .tools-footer {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 2px;
    }

    .hint-text {
      font-size: 11px;
      color: #9ca3af;
    }

    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .pill {
      padding: 3px 7px;
      border-radius: 999px;
      background: #eff6ff;
      font-size: 10px;
      color: #1d4ed8;
    }

    @media (max-width: 640px) {
      .builder-shell {
        padding: 16px;
      }
      .canvas-card {
        border-radius: 22px;
      }
      .canvas-main {
        padding: 14px 14px 18px;
      }
      .seating-rows {
        inset: 82px 18px auto 18px;
      }
      .table-zone {
        bottom: 22px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="top-bar">
      <div class="top-inner">
        <div class="top-left">
          <div class="step-pill">Step 3 of 4 · Design your layout</div>
          <div class="badge-layout">
            <span class="icon">🧩</span>
            <span>Starting from: ${layoutTitle}</span>
          </div>
        </div>
        <div class="top-actions">
          <button class="ghost-btn" type="button" data-back-layout>
            <span class="icon">←</span>
            <span>Back to layout choice</span>
          </button>
          <a class="primary-btn" href="#" data-go-tickets>
            <span>Skip to ticket setup</span>
            <span class="icon">→</span>
          </a>
        </div>
      </div>
    </header>

    <main class="builder-shell">
      <div class="builder-inner">
        <!-- Canvas side -->
        <section class="canvas-card" aria-label="Seat map builder preview">
          <header class="canvas-header">
            <div class="canvas-header-left">
              <div class="canvas-title">Room canvas</div>
              <div class="canvas-subtitle">${layoutSubtitle}</div>
            </div>
            <div class="scale-pill">
              <span>Zoom</span>
              <span>–</span>
              <span>100%</span>
              <span>+</span>
            </div>
          </header>

          <div class="canvas-body">
            <div class="canvas-toolbar">
              <div class="canvas-toolbar-left">
                <div class="toolbar-pill">
                  <span class="icon">⬚</span>
                  <span>Pan</span>
                </div>
                <div class="toolbar-pill">
                  <span class="icon">⌖</span>
                  <span>Seat blocks</span>
                </div>
                <div class="toolbar-pill">
                  <span class="icon">🪑</span>
                  <span>Tables</span>
                </div>
              </div>
              <div class="canvas-toolbar-right">
                <div class="toolbar-pill">
                  <span class="icon">☰</span>
                  <span>Layers</span>
                </div>
                <div class="toolbar-divider"></div>
                <div style="font-size:11px;color:#9ca3af;">Drag, zoom and place seats – full editor coming next.</div>
              </div>
            </div>

            <div class="canvas-main">
              <div class="grid" aria-hidden="true"></div>
              <div class="stage">STAGE</div>

              <!-- simple fake rows just for visual feel -->
              <div class="seating-rows">
                <div class="row">
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                </div>
                <div class="row">
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                </div>
                <div class="row">
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                  <div class="seat"></div>
                </div>
              </div>

              <!-- simple tables hint for cabaret / mixed layouts -->
              <div class="table-zone">
                <div class="table">
                  <div class="table-seat-left"></div>
                  <div class="table-seat-right"></div>
                </div>
                <div class="table">
                  <div class="table-seat-left"></div>
                  <div class="table-seat-right"></div>
                </div>
              </div>

              <div class="canvas-hint">
                <span>Full drag & drop builder is the next step.</span>
                <span class="key">⌘</span>
                <span class="key">Scroll</span>
                <span class="key">Drag</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Tools / inspector side -->
        <aside class="tools-card" aria-label="Layout tools">
          <header class="tools-header">
            <div class="tools-eyebrow">Tools</div>
            <div class="tools-title">Seat & table tools</div>
            <div class="tools-subtitle">
              This panel will become your live inspector for blocks, tables, zones and seat details.
            </div>
          </header>

          <section class="tool-section">
            <div class="tool-row">
              <div class="tool-main">
                <div class="tool-icon">🪑</div>
                <div class="tool-label">
                  <div class="tool-label-title">Rows & blocks</div>
                  <div class="tool-label-sub">Add, number and label seating blocks.</div>
                </div>
              </div>
              <div class="tool-chip">Coming online</div>
            </div>

            <div class="tool-row">
              <div class="tool-main">
                <div class="tool-icon">🍸</div>
                <div class="tool-label">
                  <div class="tool-label-title">Tables</div>
                  <div class="tool-label-sub">Auto-generate seats around round or long tables.</div>
                </div>
              </div>
              <div class="tool-chip">Next phase</div>
            </div>

            <div class="tool-row">
              <div class="tool-main">
                <div class="tool-icon">🟦</div>
                <div class="tool-label">
                  <div class="tool-label-title">Zones & standing</div>
                  <div class="tool-label-sub">Standing areas, VIP zones and bar sections.</div>
                </div>
              </div>
              <div class="tool-chip">In design</div>
            </div>
          </section>

          <section class="tools-footer">
            <div class="hint-text">
              For now this is a visual preview of the full builder. You can continue to ticket setup at any time –
              all existing seating tools will keep working as they do today.
            </div>
            <div class="pill-row">
              <div class="pill">No data is changed yet</div>
              <div class="pill">Safe to explore</div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  </div>

  <script>
    (function () {
      const showId = ${JSON.stringify(showId)};

      const backBtn = document.querySelector("[data-back-layout]");
      if (backBtn) {
        backBtn.addEventListener("click", function (e) {
          e.preventDefault();
          window.location.href = "/admin/seating/layout-wizard/" + encodeURIComponent(showId);
        });
      }

      const ticketsBtn = document.querySelector("[data-go-tickets]");
      if (ticketsBtn) {
        ticketsBtn.addEventListener("click", function (e) {
          e.preventDefault();
          // For now we send organisers back to the existing Tickets page for this show
          window.location.href = "/admin/ui/shows/" + encodeURIComponent(showId) + "/tickets";
        });
      }
    })();
  </script>
</body>
</html>`);
});

export default router;
