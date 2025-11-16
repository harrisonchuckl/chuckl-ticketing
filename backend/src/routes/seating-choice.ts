import { Router } from "express";

const router = Router();

router.get("/seating/layout-wizard/:showId", (req, res) => {
  const { showId } = req.params;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Choose layout – TickIn Admin</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      --bg: #f5f7ff;
      --card-border: #e3e6f2;
      --card-border-hover: #2563eb;
      --card-shadow: 0 18px 45px rgba(15, 23, 42, 0.13);
      --text-main: #0f172a;
      --text-muted: #6b7280;
      --chip-text: #4b5563;
      --accent: #2563eb;
      --radius-lg: 22px;
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
    }

    .page {
      min-height: 100vh;
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
      background: rgba(248, 250, 252, 0.86);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .top-inner {
      width: 100%;
      max-width: 1120px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .top-title {
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #6b7280;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 13px;
      color: #4b5563;
      text-decoration: none;
      border: 1px solid rgba(148, 163, 184, 0.5);
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      transition: background 0.18s ease, border-color 0.18s ease,
        transform 0.18s ease, box-shadow 0.18s ease;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    }

    .back-link span.icon {
      font-size: 14px;
      transform: translateY(-0.5px);
    }

    .back-link:hover {
      border-color: var(--accent);
      background: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
    }

    .content {
      flex: 1;
      padding: 26px 20px 40px;
      display: flex;
      justify-content: center;
    }

    .content-inner {
      width: 100%;
      max-width: 960px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .intro {
      width: 100%;
      max-width: 640px;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .intro-eyebrow {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9ca3af;
      font-weight: 600;
    }

    .intro h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #111827;
    }

    .intro p {
      margin: 2px 0 0;
      font-size: 14px;
      color: var(--text-muted);
      max-width: 520px;
    }

    .layout-grid {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px; /* even gap horizontally & vertically */
      justify-items: stretch;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .layout-grid {
        grid-template-columns: 1fr;
        max-width: 400px;
      }
    }

    .layout-card {
      position: relative;
      border-radius: var(--radius-lg);
      border: 1px solid var(--card-border);
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.8), transparent 55%),
        radial-gradient(circle at bottom right, rgba(219, 234, 254, 0.9), transparent 60%),
        #f9fafb;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
      padding: 16px 18px 14px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      aspect-ratio: 4 / 5;       /* more compact, tile-like */
      min-height: 210px;
      transition:
        transform 0.18s ease,
        box-shadow 0.18s ease,
        border-color 0.18s ease,
        background 0.18s ease;
    }

    .layout-card:hover {
      transform: translateY(-4px);
      border-color: var(--card-border-hover);
      box-shadow: var(--card-shadow);
      background:
        radial-gradient(circle at top left, rgba(239, 246, 255, 0.4), transparent 55%),
        radial-gradient(circle at bottom right, rgba(219, 234, 254, 1), transparent 60%),
        #ffffff;
    }

    .layout-card:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .layout-main {
      display: flex;
      flex-direction: row;
      gap: 12px;
      align-items: flex-start;
    }

    .layout-icon {
      flex-shrink: 0;
      width: 46px;
      height: 46px;
      border-radius: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      background:
        radial-gradient(circle at 0% 0%, #e0edff 0, #eef2ff 40%, #e0f2fe 100%);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
    }

    .layout-text {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .layout-title {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #111827;
    }

    .layout-desc {
      font-size: 13px;
      line-height: 1.4;
      color: var(--text-muted);
    }

    .layout-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }

    .chip {
      border-radius: var(--radius-pill);
      padding: 3px 8px;
      font-size: 11px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(255, 255, 255, 0.85);
      color: var(--chip-text);
      white-space: nowrap;
    }

    .layout-card:hover .chip {
      background: rgba(239, 246, 255, 0.95);
      border-color: rgba(129, 140, 248, 0.8);
    }

    .layout-footer {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-size: 11px;
      color: #9ca3af;
      margin-top: 6px;
    }

    .layout-step-pill {
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.04);
      border: 1px solid rgba(148, 163, 184, 0.35);
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
    }

    @media (max-width: 640px) {
      .content {
        padding: 20px 16px 28px;
      }
      .intro h1 {
        font-size: 20px;
      }
      .layout-card {
        aspect-ratio: auto;
        min-height: 200px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="top-bar">
      <div class="top-inner">
        <div class="top-title">Step 2 of 4 · Layout style</div>
        <a href="#" class="back-link" data-back-link>
          <span class="icon">←</span>
          <span>Back to event details</span>
        </a>
      </div>
    </header>

    <main class="content">
      <div class="content-inner">
        <section class="intro">
          <div class="intro-eyebrow">Layout style</div>
          <h1>How would you like this room to look?</h1>
          <p>Pick a starting layout for this event. You can still refine rows, tables and zones in the builder.</p>
        </section>

        <section class="layout-grid">
          <!-- Tables & chairs -->
          <button class="layout-card" type="button" data-layout="tables">
            <div class="layout-main">
              <div class="layout-icon" aria-hidden="true">🪑</div>
              <div class="layout-text">
                <div class="layout-title">Tables & chairs</div>
                <div class="layout-desc">
                  Cabaret-style maps with round or long tables and seats auto-generated around them.
                </div>
              </div>
            </div>
            <div>
              <div class="layout-chips">
                <span class="chip">Comedy rooms</span>
                <span class="chip">Drinks & tables</span>
              </div>
              <div class="layout-footer">
                <span class="layout-step-pill">Best for cabaret layouts</span>
              </div>
            </div>
          </button>

          <!-- Sections & rows -->
          <button class="layout-card" type="button" data-layout="sections">
            <div class="layout-main">
              <div class="layout-icon" aria-hidden="true">🎭</div>
              <div class="layout-text">
                <div class="layout-title">Sections & rows</div>
                <div class="layout-desc">
                  Classic theatre blocks with aisles, numbered rows and fixed seating.
                </div>
              </div>
            </div>
            <div>
              <div class="layout-chips">
                <span class="chip">Stalls / circle</span>
                <span class="chip">Fixed seating</span>
              </div>
              <div class="layout-footer">
                <span class="layout-step-pill">Best for theatres</span>
              </div>
            </div>
          </button>

          <!-- Mixed seating -->
          <button class="layout-card" type="button" data-layout="mixed">
            <div class="layout-main">
              <div class="layout-icon" aria-hidden="true">🧩</div>
              <div class="layout-text">
                <div class="layout-title">Mixed seating</div>
                <div class="layout-desc">
                  Blend tables, rows and standing zones in a single flexible map.
                </div>
              </div>
            </div>
            <div>
              <div class="layout-chips">
                <span class="chip">Flexible setups</span>
                <span class="chip">VIP zones</span>
              </div>
              <div class="layout-footer">
                <span class="layout-step-pill">Best for hybrid rooms</span>
              </div>
            </div>
          </button>

          <!-- Blank canvas -->
          <button class="layout-card" type="button" data-layout="blank">
            <div class="layout-main">
              <div class="layout-icon" aria-hidden="true">⬜</div>
              <div class="layout-text">
                <div class="layout-title">Blank canvas</div>
                <div class="layout-desc">
                  Start from an empty room and add only the tables, rows and zones you need.
                </div>
              </div>
            </div>
            <div>
              <div class="layout-chips">
                <span class="chip">Any configuration</span>
                <span class="chip">Full control</span>
              </div>
              <div class="layout-footer">
                <span class="layout-step-pill">Design from scratch</span>
              </div>
            </div>
          </button>
        </section>
      </div>
    </main>
  </div>

  <script>
    (function () {
      const showId = ${JSON.stringify(showId)};

      const cards = document.querySelectorAll(".layout-card");
      cards.forEach((card) => {
        card.addEventListener("click", () => {
          const layout = card.getAttribute("data-layout");
          if (!layout) return;
          window.location.href =
            "/admin/seating/builder/preview/" + encodeURIComponent(showId) +
            "?layout=" + encodeURIComponent(layout);
        });
      });

      const backLink = document.querySelector("[data-back-link]");
      if (backLink) {
        backLink.addEventListener("click", function (e) {
          e.preventDefault();
          window.location.href = "/admin/ui/shows/" + encodeURIComponent(showId) + "/edit";
        });
      }
    })();
  </script>
</body>
</html>`);
});

export default router;
