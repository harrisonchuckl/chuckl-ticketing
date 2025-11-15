// backend/src/routes/seating-choice.ts
import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/**
 * Seating choice screen:
 * /admin/seating-choice/:showId
 *
 * This is the TWO SQUARES page:
 * - Unallocated Seating
 * - Allocated Seating
 */
router.get(
  "/seating-choice/:showId",
  requireAdminOrOrganiser,
  (req, res) => {
    const { showId } = req.params;

    res.set("Cache-Control", "no-store");
    res
      .type("html")
      .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Choose seating – TickIn</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      --bg: #f3f4f6;
      --panel: #ffffff;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --primary: #111827;
      --primary-soft: #1118270d;
      --primary-border: #11182733;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .wrap {
      max-width: 1080px;
      width: 100%;
      margin: 0 auto;
    }
    .card {
      background: var(--panel);
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 18px 40px rgba(15,23,42,0.08);
      padding: 24px 24px 28px;
    }
    .header {
      margin-bottom: 24px;
    }
    .header-title {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .header-sub {
      font-size: 14px;
      color: var(--muted);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #f9fafb;
      color: var(--muted);
      margin-top: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }
    @media (max-width: 800px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .seat-card {
      position: relative;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: #ffffff;
      padding: 20px 18px 18px;
      cursor: pointer;
      transition:
        box-shadow 0.16s ease-out,
        transform 0.12s ease-out,
        border-color 0.16s ease-out,
        background 0.16s ease-out;
    }
    .seat-card:hover {
      box-shadow: 0 18px 40px rgba(15,23,42,0.12);
      transform: translateY(-1px);
      border-color: var(--primary-border);
      background: #f9fafb;
    }
    .seat-card h2 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .seat-card h2 span.icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 13px;
    }
    .seat-card p {
      margin: 0;
      font-size: 14px;
      color: var(--muted);
    }
    .seat-card-footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .seat-card-meta {
      font-size: 12px;
      color: var(--muted);
    }
    .btn {
      appearance: none;
      border: 1px solid var(--primary);
      background: var(--primary);
      color: #ffffff;
      border-radius: 999px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition:
        background 0.16s ease-out,
        border-color 0.16s ease-out,
        transform 0.08s ease-out,
        box-shadow 0.12s ease-out;
      white-space: nowrap;
    }
    .btn:hover {
      background: #020617;
      border-color: #020617;
      transform: translateY(-0.5px);
      box-shadow: 0 10px 30px rgba(15,23,42,0.35);
    }
    .btn.secondary {
      background: #ffffff;
      color: var(--primary);
      border-color: var(--border);
      box-shadow: none;
    }
    .btn.secondary:hover {
      border-color: var(--primary-border);
      background: #f9fafb;
      box-shadow: 0 10px 26px rgba(15,23,42,0.08);
    }
    .footer-row {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .footer-note {
      font-size: 12px;
      color: var(--muted);
    }
    .link {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
    }
    .link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
<div class="wrap" id="root" data-show-id="${showId}">
  <div class="card">
    <div class="header">
      <div class="header-title">How do you want to sell seats for this event?</div>
      <div class="header-sub">
        Choose between simple unallocated seating or a full seat map with specific seats.
      </div>
      <div class="pill">
        <span>Step 1 of 4</span>
        <span aria-hidden="true">•</span>
        <span>Seating style</span>
      </div>
    </div>

    <div class="grid">
      <!-- Unallocated -->
      <div class="seat-card" id="card-unallocated">
        <h2>
          <span class="icon">GA</span>
          Unallocated Seating
        </h2>
        <p>
          Sell tickets without a seat map. Perfect for comedy clubs and gigs where
          customers can sit anywhere.
        </p>
        <div class="seat-card-footer">
          <div class="seat-card-meta">
            No seat selection • Quick to set up • Best for simple layouts
          </div>
          <button class="btn secondary" id="btn-unallocated">
            Select
          </button>
        </div>
      </div>

      <!-- Allocated -->
      <div class="seat-card" id="card-allocated">
        <h2>
          <span class="icon">🎟</span>
          Allocated Seating
        </h2>
        <p>
          Create or reuse a detailed seating map. Let customers pick exact seats
          and assign them to different ticket types and prices.
        </p>
        <div class="seat-card-footer">
          <div class="seat-card-meta">
            Seat picker • Zones & blocks • Best for theatres & mixed layouts
          </div>
          <button class="btn" id="btn-allocated">
            Select
          </button>
        </div>
      </div>
    </div>

    <div class="footer-row">
      <div class="footer-note">
        You can change seating style later before going on sale.
      </div>
      <a class="link" id="back-to-show">Back to event details</a>
    </div>
  </div>
</div>

<script>
(function() {
  var root = document.getElementById('root');
  if (!root) return;
  var showId = root.getAttribute('data-show-id') || '';

  function go(path) {
    if (!showId) return;
    window.location.href = path.replace(':showId', encodeURIComponent(showId));
  }

  var cardUnalloc = document.getElementById('card-unallocated');
  var cardAlloc   = document.getElementById('card-allocated');
  var btnUnalloc  = document.getElementById('btn-unallocated');
  var btnAlloc    = document.getElementById('btn-allocated');
  var backLink    = document.getElementById('back-to-show');

  if (cardUnalloc) {
    cardUnalloc.addEventListener('click', function() {
      go('/admin/seating/unallocated/:showId');
    });
  }
  if (btnUnalloc) {
    btnUnalloc.addEventListener('click', function(ev) {
      ev.stopPropagation();
      go('/admin/seating/unallocated/:showId');
    });
  }

  if (cardAlloc) {
    cardAlloc.addEventListener('click', function() {
      go('/admin/seating/layout-wizard/:showId');
    });
  }
  if (btnAlloc) {
    btnAlloc.addEventListener('click', function(ev) {
      ev.stopPropagation();
      go('/admin/seating/layout-wizard/:showId');
    });
  }

  if (backLink) {
    backLink.addEventListener('click', function(ev) {
      ev.preventDefault();
      if (!showId) return;
      // back to the standard admin UI edit screen for this show
      window.location.href = '/admin/ui/shows/' + encodeURIComponent(showId) + '/edit';
    });
  }
})();
</script>
</body>
</html>`);
  }
);

/**
 * Minimal stubs so clicks don't 404.
 * We will replace these with the full flows next.
 */
router.get(
  "/seating/unallocated/:showId",
  requireAdminOrOrganiser,
  (req, res) => {
    const { showId } = req.params;
    res
      .type("html")
      .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Unallocated seating – TickIn</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:24px;">
  <h1>Unallocated seating – coming next</h1>
  <p>This is a placeholder for the unallocated seating flow for show <code>${showId}</code>.</p>
  <p>Next step: this page will become the "Add ticket types for unallocated events" screen.</p>
  <p><a href="/admin/ui/shows/${showId}/tickets">Go to tickets page for this show</a></p>
</body>
</html>`);
  }
);

router.get(
  "/seating/layout-wizard/:showId",
  requireAdminOrOrganiser,
  (req, res) => {
    const { showId } = req.params;
    res
      .type("html")
      .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Layout wizard – TickIn</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:24px;">
  <h1>Layout wizard – coming next</h1>
  <p>This will become the full layout-type selection page (Tables & Chairs, Sections & Rows, Mixed Seating, Blank Canvas) for show <code>${showId}</code>.</p>
  <p>For now it's just a stub so your navigation works.</p>
  <p><a href="/admin/seating-choice/${showId}">Back to seating choice</a></p>
</body>
</html>`);
  }
);

export default router;
