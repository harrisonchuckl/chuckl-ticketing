import { Router } from "express";

const router = Router();

/**
 * Step 1 – seating style choice (Unallocated vs Allocated)
 */
function renderSeatingChoicePage(showId: string) {
  const backUrl = `/admin/ui/shows/${encodeURIComponent(showId)}/edit`;
  const unallocatedUrl = `/admin/seating/unallocated/${encodeURIComponent(
    showId
  )}`;
  const allocatedUrl = `/admin/seating/layout-wizard/${encodeURIComponent(
    showId
  )}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Seating style – TickIn Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #f5f7fb;
      --card-bg: #ffffff;
      --border-subtle: #e2e4ea;
      --border-strong: #c4c7d2;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.08);
      --accent-ring: rgba(37, 99, 235, 0.45);
      --text-main: #0f172a;
      --text-muted: #6b7280;
      --shadow-soft: 0 18px 45px rgba(15, 23, 42, 0.08);
      --radius-xl: 24px;
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
        "Segoe UI", sans-serif;
      color: var(--text-main);
      background: radial-gradient(circle at top left, #eef2ff 0, #f9fafb 40%, #f3f4f6 100%);
    }

    body {
      display: flex;
      align-items: stretch;
      justify-content: center;
    }

    .page {
      flex: 1;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
    }

    .shell {
      width: 100%;
      max-width: 1080px;
      background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.98));
      border-radius: 32px;
      box-shadow: var(--shadow-soft);
      border: 1px solid rgba(148, 163, 184, 0.22);
      padding: 28px 28px 26px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    @media (min-width: 900px) {
      .shell {
        padding: 28px 32px 26px;
      }
    }

    .shell-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .title-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-weight: 500;
    }

    .step-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 3px rgba(37,99,235,0.25);
    }

    h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -0.03em;
      font-weight: 600;
    }

    .subtitle {
      margin: 0;
      font-size: 13px;
      color: var(--text-muted);
    }

    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.5);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(8px);
      transition: all 140ms ease-out;
    }

    .back-link:hover {
      border-color: rgba(148, 163, 184, 0.9);
      background: #ffffff;
      color: #111827;
    }

    .back-chevron {
      font-size: 14px;
      transform: translateY(-0.5px);
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-top: 6px;
    }

    .cards-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    @media (max-width: 720px) {
      .cards-row {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .choice-card {
      position: relative;
      border-radius: var(--radius-xl);
      border: 1px solid var(--border-subtle);
      background: var(--card-bg);
      padding: 18px 18px 16px;
      cursor: pointer;
      overflow: hidden;
      transition: all 150ms ease-out;
      display: flex;
      flex-direction: column;
      min-height: 124px;
    }

    .choice-card:hover {
      border-color: var(--accent);
      box-shadow: 0 16px 35px rgba(15, 23, 42, 0.11);
      transform: translateY(-2px);
    }

    .choice-card:active {
      transform: translateY(0);
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.09);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #2563eb;
    }

    .card-title {
      font-size: 16px;
      letter-spacing: -0.02em;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .card-text {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 340px;
    }

    .chip-row {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      font-size: 11px;
      padding: 3px 9px;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.6);
      color: #4b5563;
      background: rgba(249, 250, 251, 0.8);
    }

    .choice-card.accent {
      background: radial-gradient(circle at top left, #eef2ff 0, #ffffff 55%);
    }

    .choice-card.accent .chip {
      border-color: rgba(37, 99, 235, 0.35);
      background: rgba(239, 246, 255, 0.7);
      color: #1d4ed8;
    }

    a.card-link {
      text-decoration: none;
      color: inherit;
      display: block;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="shell">
      <div class="shell-header">
        <div class="title-block">
          <div class="step-pill">
            <span class="step-dot"></span>
            <span>Step 1 of 4 · Seating style</span>
          </div>
          <h1>How do you want to sell seats for this event?</h1>
          <p class="subtitle">Choose between simple unallocated seating or a detailed seat map. You can change this later.</p>
        </div>
        <a class="back-link" href="${backUrl}">
          <span class="back-chevron">←</span>
          <span>Back to event details</span>
        </a>
      </div>

      <div class="content">
        <div class="cards-row">
          <a class="card-link" href="${unallocatedUrl}">
            <div class="choice-card">
              <span class="badge">
                <span class="badge-dot"></span>
                <span>General admission</span>
              </span>
              <div class="card-title">Unallocated seating</div>
              <div class="card-text">
                Sell tickets without seat numbers. Ideal for comedy clubs and relaxed events where customers sit anywhere.
              </div>
              <div class="chip-row">
                <span class="chip">Fast to set up</span>
                <span class="chip">No seat map</span>
              </div>
            </div>
          </a>

          <a class="card-link" href="${allocatedUrl}">
            <div class="choice-card accent">
              <span class="badge">
                <span class="badge-dot"></span>
                <span>Seat picker</span>
              </span>
              <div class="card-title">Allocated seating</div>
              <div class="card-text">
                Let customers choose their exact seats with a reusable seating map tailored to this venue.
              </div>
              <div class="chip-row">
                <span class="chip">Seat map</span>
                <span class="chip">Zones &amp; rows</span>
                <span class="chip">Perfect for theatres</span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Step 2 – layout type wizard (Tables & Chairs, Sections & Rows, Mixed, Blank)
 *  >>> UPDATED to be cleaner, more modern, bigger icons/titles, less text.
 */
function renderLayoutWizardPage(showId: string) {
  const backUrl = `/admin/seating-choice/${encodeURIComponent(showId)}`;
  // For now we just send users to a stub builder with a placeholder seatmap ID.
  const builderBase = `/admin/seating/builder/preview-${encodeURIComponent(
    showId
  )}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Layout type – TickIn Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #f5f7fb;
      --card-bg: #ffffff;
      --border-subtle: #e2e4ea;
      --accent: #2563eb;
      --text-main: #0f172a;
      --text-muted: #6b7280;
      --shadow-soft: 0 18px 45px rgba(15, 23, 42, 0.08);
      --radius-xl: 24px;
      --radius-pill: 999px;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", sans-serif;
      color: var(--text-main);
      background: radial-gradient(circle at top left, #eef2ff 0, #f9fafb 40%, #f3f4f6 100%);
    }

    body {
      display: flex;
      align-items: stretch;
      justify-content: center;
    }

    .page {
      flex: 1;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
    }

    .shell {
      width: 100%;
      max-width: 1080px;
      background: linear-gradient(135deg, rgba(255,255,255,0.94), rgba(248,250,252,0.99));
      border-radius: 32px;
      box-shadow: var(--shadow-soft);
      border: 1px solid rgba(148, 163, 184, 0.22);
      padding: 28px 28px 26px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    @media (min-width: 900px) {
      .shell { padding: 28px 32px 26px; }
    }

    .shell-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .title-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-weight: 500;
    }

    .step-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 3px rgba(37,99,235,0.25);
    }

    h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -0.03em;
      font-weight: 600;
    }

    .subtitle {
      margin: 0;
      font-size: 13px;
      color: var(--text-muted);
    }

    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.5);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(8px);
      transition: all 140ms ease-out;
    }

    .back-link:hover {
      border-color: rgba(148, 163, 184, 0.9);
      background: #ffffff;
      color: #111827;
    }

    .back-chevron {
      font-size: 14px;
      transform: translateY(-0.5px);
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-top: 6px;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    @media (max-width: 860px) {
      .cards-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .layout-card {
      position: relative;
      border-radius: var(--radius-xl);
      border: 1px solid var(--border-subtle);
      background: var(--card-bg);
      padding: 18px 18px 16px;
      cursor: pointer;
      overflow: hidden;
      transition: all 150ms ease-out;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: space-between;
      aspect-ratio: 1 / 1; /* more square */
    }

    .layout-card:hover {
      border-color: var(--accent);
      box-shadow: 0 16px 35px rgba(15, 23, 42, 0.11);
      transform: translateY(-2px);
    }

    .layout-card:active {
      transform: translateY(0);
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.09);
    }

    .layout-header {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
    }

    .layout-icon {
      width: 52px;
      height: 52px;
      border-radius: 18px;
      background: radial-gradient(circle at 30% 20%, #eff6ff 0, #dbeafe 40%, #bfdbfe 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
    }

    .icon-dot, .icon-line, .icon-block {
      position: absolute;
      border-radius: 999px;
      background: rgba(15,23,42,0.9);
    }

    .icon-dot { width: 6px; height: 6px; }
    .icon-line { height: 3px; border-radius: 999px; }
    .icon-block { border-radius: 7px; }

    .layout-title {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 2px;
    }

    .layout-text {
      font-size: 12px;
      color: var(--text-muted);
      max-width: 260px;
    }

    .layout-meta {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .meta-chip {
      font-size: 11px;
      padding: 3px 9px;
      border-radius: var(--radius-pill);
      border: 1px solid rgba(148, 163, 184, 0.6);
      color: #4b5563;
      background: rgba(249, 250, 251, 0.8);
    }

    .layout-card.primary {
      background: radial-gradient(circle at top left, #eef2ff 0, #ffffff 60%);
    }

    .layout-card.primary .layout-icon {
      background: radial-gradient(circle at 20% 15%, #eff6ff 0, #dbeafe 35%, #bfdbfe 80%);
    }

    a.layout-link {
      text-decoration: none;
      color: inherit;
      display: block;
      height: 100%;
    }

    .footer-note {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="shell">
      <div class="shell-header">
        <div class="title-block">
          <div class="step-pill">
            <span class="step-dot"></span>
            <span>Step 2 of 4 · Layout type</span>
          </div>
          <h1>What kind of seating layout do you need?</h1>
          <p class="subtitle">Pick the layout that best matches this room. You’ll fine-tune it in the builder.</p>
        </div>
        <a class="back-link" href="${backUrl}">
          <span class="back-chevron">←</span>
          <span>Back to seating style</span>
        </a>
      </div>

      <div class="content">
        <div class="cards-grid">
          <!-- Tables & Chairs -->
          <a class="layout-link" href="${builderBase}?layout=tables">
            <div class="layout-card primary">
              <div class="layout-header">
                <div class="layout-icon">
                  <div class="icon-dot" style="top: 11px; left: 12px;"></div>
                  <div class="icon-dot" style="top: 11px; right: 12px;"></div>
                  <div class="icon-dot" style="bottom: 11px; left: 12px;"></div>
                  <div class="icon-dot" style="bottom: 11px; right: 12px;"></div>
                  <div class="icon-line" style="width: 70%; top: 50%; left: 15%; transform: translateY(-50%); background: rgba(30,64,175,0.9);"></div>
                </div>
                <div>
                  <div class="layout-title">Tables & chairs</div>
                  <div class="layout-text">
                    Cabaret-style with round or long tables and seats auto-generated around them.
                  </div>
                </div>
              </div>
              <div class="layout-meta">
                <span class="meta-chip">Comedy rooms</span>
                <span class="meta-chip">Drinks & tables</span>
              </div>
            </div>
          </a>

          <!-- Sections & Rows -->
          <a class="layout-link" href="${builderBase}?layout=sections">
            <div class="layout-card">
              <div class="layout-header">
                <div class="layout-icon">
                  <div class="icon-line" style="width: 80%; top: 14px; left: 10%; background: rgba(15,23,42,0.9);"></div>
                  <div class="icon-line" style="width: 80%; top: 22px; left: 10%; background: rgba(15,23,42,0.85);"></div>
                  <div class="icon-line" style="width: 80%; top: 30px; left: 10%; background: rgba(15,23,42,0.8);"></div>
                </div>
                <div>
                  <div class="layout-title">Sections & rows</div>
                  <div class="layout-text">
                    Classic theatre blocks with aisles and numbered seats.
                  </div>
                </div>
              </div>
              <div class="layout-meta">
                <span class="meta-chip">Stalls / circle</span>
                <span class="meta-chip">Fixed seating</span>
              </div>
            </div>
          </a>

          <!-- Mixed seating -->
          <a class="layout-link" href="${builderBase}?layout=mixed">
            <div class="layout-card">
              <div class="layout-header">
                <div class="layout-icon">
                  <div class="icon-dot" style="top: 12px; left: 10px;"></div>
                  <div class="icon-dot" style="top: 12px; right: 10px;"></div>
                  <div class="icon-line" style="width: 70%; bottom: 11px; left: 15%; background: rgba(15,23,42,0.9);"></div>
                  <div class="icon-block" style="width: 18px; height: 11px; top: 18px; left: 11px; background: rgba(15,23,42,0.86); border-radius: 5px;"></div>
                  <div class="icon-block" style="width: 18px; height: 11px; top: 18px; right: 11px; background: rgba(15,23,42,0.78); border-radius: 5px;"></div>
                </div>
                <div>
                  <div class="layout-title">Mixed seating</div>
                  <div class="layout-text">
                    Blend tables, rows and standing zones in one flexible map.
                  </div>
                </div>
              </div>
              <div class="layout-meta">
                <span class="meta-chip">Hybrid spaces</span>
                <span class="meta-chip">Standing + seated</span>
              </div>
            </div>
          </a>

          <!-- Blank canvas -->
          <a class="layout-link" href="${builderBase}?layout=blank">
            <div class="layout-card">
              <div class="layout-header">
                <div class="layout-icon">
                  <div class="icon-block" style="width: 26px; height: 16px; top: 11px; left: 9px; background: rgba(15,23,42,0.9); border-radius: 6px;"></div>
                  <div class="icon-block" style="width: 16px; height: 11px; bottom: 10px; right: 9px; background: rgba(15,23,42,0.72); border-radius: 5px;"></div>
                </div>
                <div>
                  <div class="layout-title">Blank canvas</div>
                  <div class="layout-text">
                    Start from an empty room and design exactly what you want.
                  </div>
                </div>
              </div>
              <div class="layout-meta">
                <span class="meta-chip">Full control</span>
                <span class="meta-chip">Any configuration</span>
              </div>
            </div>
          </a>
        </div>

        <p class="footer-note">
          Next: the full-screen builder where you’ll place seats, then assign ticket types and prices.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Stub – Unallocated seating ticket setup.
 * For now this simply links back into the existing Tickets page.
 */
function renderUnallocatedStub(showId: string) {
  const ticketsUrl = `/admin/ui/shows/${encodeURIComponent(showId)}/tickets`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Unallocated seating – TickIn Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", sans-serif;
      background: #f3f4f6;
      color: #0f172a;
    }
    .card {
      max-width: 640px;
      margin: 40px auto;
      padding: 24px 22px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      box-shadow: 0 14px 35px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    p {
      margin: 0 0 16px;
      font-size: 14px;
      color: #4b5563;
    }
    a.button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 14px;
      border-radius: 999px;
      border: none;
      background: #111827;
      color: #f9fafb;
      font-size: 14px;
      text-decoration: none;
      cursor: pointer;
    }
    a.button:hover {
      background: #020617;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unallocated seating</h1>
    <p>
      This event will use simple general admission tickets with no seat map.
      You can now set up your ticket types as usual.
    </p>
    <a class="button" href="${ticketsUrl}">Go to ticket types</a>
  </div>
</body>
</html>`;
}

/**
 * Stub – Seatmap builder placeholder
 */
function renderBuilderStub(seatmapId: string) {
  const pricingUrl = `/admin/seating/pricing/${encodeURIComponent(seatmapId)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Seat map builder (preview) – TickIn Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", sans-serif;
      background: #020617;
      color: #e5e7eb;
    }
    .card {
      max-width: 860px;
      margin: 32px auto;
      padding: 24px 22px;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.5);
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.7);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    p {
      margin: 0 0 16px;
      font-size: 14px;
      color: #9ca3af;
    }
    code {
      font-size: 12px;
      background: rgba(15,23,42,0.9);
      padding: 2px 6px;
      border-radius: 4px;
    }
    a.button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 14px;
      border-radius: 999px;
      border: none;
      background: #f9fafb;
      color: #020617;
      font-size: 14px;
      text-decoration: none;
      cursor: pointer;
    }
    a.button:hover {
      background: #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Seat map builder – coming next</h1>
    <p>
      This is a placeholder for the full-screen layout builder.
      You navigated here with seat map ID <code>${seatmapId}</code>.
    </p>
    <p>
      In the next phase, this page will show the drag-and-drop editor for tables, rows and mixed layouts.
    </p>
    <a class="button" href="${pricingUrl}">Continue to pricing step</a>
  </div>
</body>
</html>`;
}

/**
 * Stub – Pricing / ticket assignment placeholder
 */
function renderPricingStub(seatmapId: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Seat map pricing – TickIn Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", sans-serif;
      background: #f9fafb;
      color: #0f172a;
    }
    .card {
      max-width: 720px;
      margin: 40px auto;
      padding: 24px 22px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    p {
      margin: 0 0 16px;
      font-size: 14px;
      color: #4b5563;
    }
    code {
      font-size: 12px;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Pricing & ticket assignment – coming next</h1>
    <p>
      This is a placeholder for assigning ticket types and prices to seats
      for seat map <code>${seatmapId}</code>.
    </p>
    <p>
      In the final version, this step will let you configure ticket types,
      map them to zones or individual seats, and publish the event for sale.
    </p>
  </div>
</body>
</html>`;
}

// --------- Routes ---------

// Step 1 – seating style choice
router.get("/seating-choice/:showId", (req, res) => {
  const { showId } = req.params;
  res.type("html").send(renderSeatingChoicePage(showId));
});

// Unallocated seating stub
router.get("/seating/unallocated/:showId", (req, res) => {
  const { showId } = req.params;
  res.type("html").send(renderUnallocatedStub(showId));
});

// Step 2 – layout type wizard
router.get("/seating/layout-wizard/:showId", (req, res) => {
  const { showId } = req.params;
  res.type("html").send(renderLayoutWizardPage(showId));
});

// Builder stub
router.get("/seating/builder/:seatmapId", (req, res) => {
  const { seatmapId } = req.params;
  res.type("html").send(renderBuilderStub(seatmapId));
});

// Pricing stub
router.get("/seating/pricing/:seatmapId", (req, res) => {
  const { seatmapId } = req.params;
  res.type("html").send(renderPricingStub(seatmapId));
});

export default router;
